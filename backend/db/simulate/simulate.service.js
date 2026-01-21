import { db } from "../../firestore.js";
import fixturesService from "../fixtures/fixtures.service.js";
import { userPredictionsService } from "../userPredictions/userPredictions.service.js";
import leagueScores2Service from "../leagueScores/leagueScores2.service.js";

const BATCH_SIZE = 400; // Firestore batch limit is 500, stay safe
const PAGE_SIZE = 1000; // Process users in pages

/**
 * Simulate predictions and score calculations for a specific gameweek
 * Optimized for millions of users using:
 * - Pagination to avoid loading all users into memory
 * - Batch writes for efficient database operations
 * - Set operations to find users without predictions
 */
const simulateGameweek = async (gameweek) => {
  console.log(`[SIMULATE] Starting simulation for gameweek ${gameweek}...`);

  const results = {
    gameweek,
    totalUsers: 0,
    usersWithoutPredictions: 0,
    usersSkippedJoinedLater: 0,
    defaultPredictionsCreated: 0,
    scoresCalculated: 0,
    leaguesUpdated: 0,
    errors: [],
  };

  try {
    // 1. Get all fixtures for this gameweek (small dataset, ok to load fully)
    const fixtures = await fixturesService.getFixtureById(gameweek);
    if (!fixtures || fixtures.length === 0) {
      throw new Error(`No fixtures found for gameweek ${gameweek}`);
    }
    console.log(
      `[SIMULATE] Found ${fixtures.length} fixtures for gameweek ${gameweek}`
    );

    // 2. Get all existing predictions for this gameweek (to find who's missing)
    // Using a Set for O(1) lookup
    const existingPredictionUserIds = new Set();
    let predictionCursor = null;

    console.log(`[SIMULATE] Fetching existing predictions...`);
    do {
      let query = db
        .collection("userPredictions")
        .where("event", "==", parseInt(gameweek))
        .limit(PAGE_SIZE);

      if (predictionCursor) {
        query = query.startAfter(predictionCursor);
      }

      const predictionSnap = await query.get();

      predictionSnap.docs.forEach((doc) => {
        const data = doc.data();
        // Only count as "has predictions" if they actually submitted some
        if (data.predictions && data.predictions.length > 0) {
          existingPredictionUserIds.add(data.user_id);
        }
      });

      predictionCursor =
        predictionSnap.docs.length > 0
          ? predictionSnap.docs[predictionSnap.docs.length - 1]
          : null;
    } while (predictionCursor);

    console.log(
      `[SIMULATE] Found ${existingPredictionUserIds.size} users with existing predictions`
    );

    // 3. Process users in paginated batches
    let userCursor = null;
    let batch = db.batch();
    let batchCount = 0;
    let skippedUsers = 0;

    console.log(`[SIMULATE] Processing users in batches...`);
    do {
      let userQuery = db.collection("users").limit(PAGE_SIZE);

      if (userCursor) {
        userQuery = userQuery.startAfter(userCursor);
      }

      const usersSnap = await userQuery.get();

      if (usersSnap.empty) break;

      results.totalUsers += usersSnap.docs.length;

      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Skip if user joined after this gameweek
        const userJoinedGameweek = userData.joined_gameweek || 1;
        if (userJoinedGameweek > gameweek) {
          skippedUsers++;
          results.usersSkippedJoinedLater++;
          continue;
        }

        // Skip if user already has predictions
        if (existingPredictionUserIds.has(userId)) {
          continue;
        }

        results.usersWithoutPredictions++;
        console.log(
          `username=${userData?.email}, favoriteTeamId=${userData?.favorite_team_id}`
        );

        // Create default predictions for this user
        const defaultPredictions = createDefaultPredictions(
          fixtures,
          userData.favorite_team_id
        );

        const docId = `${userId}_${gameweek}`;
        const docRef = db.collection("userPredictions").doc(docId);

        batch.set(
          docRef,
          {
            user_id: userId,
            event: parseInt(gameweek),
            predictions: defaultPredictions,
            is_simulated: true,
            generatedBy: "SYSTEM",
            created_at: new Date(),
            updated_at: new Date(),
          },
          { merge: true }
        );

        batchCount++;
        results.defaultPredictionsCreated++;

        // Commit batch when it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(
            `[SIMULATE] Committed batch of ${batchCount} predictions`
          );
          batch = db.batch();
          batchCount = 0;
        }
      }

      userCursor = usersSnap.docs[usersSnap.docs.length - 1];
    } while (userCursor);

    // Commit any remaining items in the batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(
        `[SIMULATE] Committed final batch of ${batchCount} predictions`
      );
    }

    console.log(
      `[SIMULATE] Skipped ${skippedUsers} users who joined after gameweek ${gameweek}`
    );
    console.log(
      `[SIMULATE] Created ${results.defaultPredictionsCreated} default predictions for ${results.usersWithoutPredictions} users`
    );

    // 4. Calculate scores for all users for this gameweek
    console.log(
      `[SIMULATE] Calculating scores for all users in gameweek ${gameweek}...`
    );
    try {
      const scoreResult =
        await userPredictionsService.calculateScoresForAllUsers(gameweek);
      results.scoresCalculated = scoreResult.processedUsers || 0;
      console.log(
        `[SIMULATE] Calculated scores for ${results.scoresCalculated} users`
      );
    } catch (scoreError) {
      console.error("[SIMULATE] Error calculating scores:", scoreError.message);
      results.errors.push({
        type: "score_calculation",
        error: scoreError.message,
      });
    }

    // 5. Update league scores for this gameweek
    console.log(
      `[SIMULATE] Updating league scores for gameweek ${gameweek}...`
    );
    try {
      const leagueResult =
        await leagueScores2Service.updateAllLeagueScoresForGameweek(gameweek);
      results.leaguesUpdated = leagueResult.processed || 0;
      console.log(`[SIMULATE] Updated ${results.leaguesUpdated} league scores`);
    } catch (leagueError) {
      console.error(
        "[SIMULATE] Error updating league scores:",
        leagueError.message
      );
      results.errors.push({
        type: "league_scores",
        error: leagueError.message,
      });
    }

    console.log(`[SIMULATE] Simulation complete for gameweek ${gameweek}`);
    return results;
  } catch (error) {
    console.error(`[SIMULATE] Critical error:`, error);
    results.errors.push({
      type: "critical",
      error: error.message,
    });
    throw error;
  }
};

/**
 * Create default predictions for a user
 * - All fixtures get 0-0 scoreline
 * - Captain is set on the fixture with the user's favorite team
 * @param {Array} fixtures - Array of fixture objects
 * @param {number|string|null} favoriteTeamId - User's favorite team ID
 * @returns {Array} Array of prediction objects
 */
const createDefaultPredictions = (fixtures, favoriteTeamId) => {
  let captainSet = false;

  // Convert favoriteTeamId to number for consistent comparison
  const favTeamId = favoriteTeamId ? parseInt(favoriteTeamId, 10) : null;

  const predictions = fixtures.map((fixture) => {
    // Check if this fixture involves the user's favorite team
    // Convert fixture team IDs to numbers for consistent comparison
    const homeTeamId = parseInt(fixture.team_h, 10);
    const awayTeamId = parseInt(fixture.team_a, 10);

    const isFavoriteTeamFixture =
      favTeamId !== null &&
      !isNaN(favTeamId) &&
      (homeTeamId === favTeamId || awayTeamId === favTeamId);

    // Set captain on favorite team's fixture (only the first one if multiple)
    let isCaptain = false;
    if (isFavoriteTeamFixture && !captainSet) {
      isCaptain = true;
      captainSet = true;
    }

    return {
      id: fixture.id,
      fixture_id: fixture.id,
      team_h_score: 0,
      team_a_score: 0,
      captain: isCaptain,
      stats: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  // If no favorite team fixture found, set captain on the first fixture
  if (!captainSet && predictions.length > 0) {
    predictions[0].captain = true;
  }

  return predictions;
};

/**
 * Simulate multiple gameweeks at once
 * @param {number} startGameweek - Starting gameweek
 * @param {number} endGameweek - Ending gameweek (inclusive)
 * @returns {Object} Results for each gameweek
 */
const simulateGameweekRange = async (startGameweek, endGameweek) => {
  const results = {
    startGameweek,
    endGameweek,
    gameweekResults: [],
    totalUsersProcessed: 0,
    totalPredictionsCreated: 0,
    totalErrors: 0,
  };

  for (let gw = startGameweek; gw <= endGameweek; gw++) {
    console.log(`[SIMULATE] Processing gameweek ${gw}/${endGameweek}...`);
    try {
      const gwResult = await simulateGameweek(gw);
      results.gameweekResults.push(gwResult);
      results.totalPredictionsCreated += gwResult.defaultPredictionsCreated;
      results.totalUsersProcessed += gwResult.scoresCalculated;
      results.totalErrors += gwResult.errors.length;
    } catch (error) {
      results.gameweekResults.push({
        gameweek: gw,
        error: error.message,
      });
      results.totalErrors++;
    }
  }

  return results;
};

export const simulateService = {
  simulateGameweek,
  simulateGameweekRange,
  createDefaultPredictions,
};

export default simulateService;
