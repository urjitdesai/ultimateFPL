import { db } from "../../firestore.js";
import userPredictionsService from "../userPredictions/userPredictions.service.js";

/**
 * League Scores Service v2
 *
 * This service manages league-specific scores where each user's total score
 * in a league is calculated from the gameweek they joined (not from GW1).
 *
 * Document structure for league_scores collection:
 *
 * Document ID: {leagueId}_{userId}
 * Fields:
 *   - leagueId: string
 *   - userId: string
 *   - joinedGameweek: number (gameweek when user joined this league)
 *   - totalScore: number (pre-calculated total from joinedGameweek onwards)
 *   - gameweekScores: { [gameweek: string]: number } (score per gameweek)
 *   - lastUpdatedGameweek: number
 *   - createdAt: timestamp
 *   - updatedAt: timestamp
 */

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Batch fetch user details for a list of user IDs
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Map<string, {name: string, email: string|null}>>}
 */
const fetchUserDetailsMap = async (userIds) => {
  const userDocs = await Promise.all(
    userIds.map((userId) => db.collection("users").doc(userId).get())
  );

  const userMap = new Map();
  userDocs.forEach((doc) => {
    if (doc.exists) {
      const data = doc.data();
      userMap.set(doc.id, {
        name: data.display_name || data.name || data.email || "Unknown",
        email: data.email || null,
      });
    }
  });

  return userMap;
};

/**
 * Calculate cumulative score from joinedGameweek to targetGameweek
 * @param {Object} gameweekScores - Map of gameweek to score
 * @param {number} joinedGameweek - Gameweek user joined
 * @param {number} targetGameweek - Gameweek to calculate up to
 * @returns {number}
 */
const calculateScoreUpToGameweek = (
  gameweekScores,
  joinedGameweek,
  targetGameweek
) => {
  let total = 0;
  for (let gw = joinedGameweek; gw <= targetGameweek; gw++) {
    total += gameweekScores[gw.toString()] || 0;
  }
  return total;
};

/**
 * Calculate total score from all gameweek scores
 * @param {Object} gameweekScores - Map of gameweek to score
 * @returns {number}
 */
const calculateTotalScore = (gameweekScores) => {
  return Object.values(gameweekScores).reduce((a, b) => a + b, 0);
};

/**
 * Assign ranks to sorted entries (handles ties)
 * @param {Array} entries - Sorted array of entries
 * @param {string} scoreField - Field name to use for ranking (e.g., 'totalScore' or 'gameweekScore')
 */
const assignRanks = (entries, scoreField = "totalScore") => {
  let currentRank = 1;
  entries.forEach((entry, index) => {
    if (index > 0 && entry[scoreField] === entries[index - 1][scoreField]) {
      entry.rank = entries[index - 1].rank;
    } else {
      entry.rank = currentRank;
    }
    currentRank++;
  });
};

/**
 * Get league scores snapshot for a league
 * @param {string} leagueId - The league ID
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
const getLeagueScoresSnapshot = async (leagueId) => {
  return db.collection("league_scores").where("leagueId", "==", leagueId).get();
};

// ============================================
// INITIALIZATION & MANAGEMENT
// ============================================

/**
 * Initialize league score document when user joins a league
 * @param {string} leagueId - The league ID
 * @param {string} userId - The user ID
 * @param {number} joinedGameweek - The gameweek when user joined
 * @returns {Promise<{success: boolean, docId: string, alreadyExists?: boolean}>}
 */
const initializeUserLeagueScore = async (leagueId, userId, joinedGameweek) => {
  const docId = `${leagueId}_${userId}`;
  const docRef = db.collection("league_scores").doc(docId);

  try {
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      console.log(`League score doc ${docId} already exists`);
      return { success: true, docId, alreadyExists: true };
    }

    await docRef.set({
      leagueId,
      userId,
      joinedGameweek: parseInt(joinedGameweek),
      totalScore: 0,
      gameweekScores: {},
      lastUpdatedGameweek: parseInt(joinedGameweek) - 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(
      `Initialized league score for user ${userId} in league ${leagueId}, joined GW ${joinedGameweek}`
    );
    return { success: true, docId };
  } catch (error) {
    console.error(`Error initializing league score for ${docId}:`, error);
    throw error;
  }
};

/**
 * Get a user's league score document
 * @param {string} leagueId - The league ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>}
 */
const getUserLeagueScore = async (leagueId, userId) => {
  const docId = `${leagueId}_${userId}`;
  const doc = await db.collection("league_scores").doc(docId).get();

  if (!doc.exists) {
    return null;
  }

  return { id: doc.id, ...doc.data() };
};

// ============================================
// SCORE UPDATES
// ============================================

/**
 * Update a single user's league score for a specific gameweek
 * @param {string} leagueId - The league ID
 * @param {string} userId - The user ID
 * @param {number} gameweek - The gameweek number
 * @param {number} score - The score for this gameweek
 * @returns {Promise<Object>}
 */
const updateUserLeagueGameweekScore = async (
  leagueId,
  userId,
  gameweek,
  score
) => {
  const docId = `${leagueId}_${userId}`;
  const docRef = db.collection("league_scores").doc(docId);

  try {
    const doc = await docRef.get();
    if (!doc.exists) {
      console.warn(`League score doc ${docId} not found`);
      return { success: false, error: "Document not found" };
    }

    const data = doc.data();

    // Skip if gameweek is before user joined
    if (gameweek < data.joinedGameweek) {
      return { skipped: true, reason: "Gameweek before join date" };
    }

    const gameweekScores = data.gameweekScores || {};
    const previousScore = gameweekScores[gameweek.toString()] || 0;
    gameweekScores[gameweek.toString()] = score;

    // Recalculate total score from all gameweek scores
    const totalScore = calculateTotalScore(gameweekScores);

    await docRef.update({
      gameweekScores,
      totalScore,
      lastUpdatedGameweek: Math.max(data.lastUpdatedGameweek || 0, gameweek),
      updatedAt: new Date(),
    });

    return {
      success: true,
      previousScore,
      newScore: score,
      totalScore,
    };
  } catch (error) {
    console.error(`Error updating league score for ${docId}:`, error);
    throw error;
  }
};

/**
 * Batch update all league scores for a specific gameweek
 * Called after user prediction scores are calculated for a gameweek
 * @param {number} gameweek - The gameweek number
 * @returns {Promise<{processed: number, skipped: number}>}
 */
const updateAllLeagueScoresForGameweek = async (gameweek) => {
  console.log(`Updating all league scores for gameweek ${gameweek}...`);

  try {
    const leagueScoresSnapshot = await db.collection("league_scores").get();

    if (leagueScoresSnapshot.empty) {
      console.log("No league score documents found");
      return { processed: 0, skipped: 0 };
    }

    let processed = 0;
    let skipped = 0;
    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;

    // Cache user scores to minimize redundant queries
    // (same user may be in multiple leagues)
    const userScoreCache = new Map();

    for (const doc of leagueScoresSnapshot.docs) {
      const data = doc.data();
      const { userId, joinedGameweek, gameweekScores = {} } = data;

      // Skip if user joined after this gameweek
      if (gameweek < joinedGameweek) {
        skipped++;
        continue;
      }

      // Get user's score for this gameweek (with caching)
      let gameweekScore;
      if (userScoreCache.has(userId)) {
        gameweekScore = userScoreCache.get(userId);
      } else {
        try {
          gameweekScore = await userPredictionsService.getUserGameweekScore(
            userId,
            gameweek
          );
          userScoreCache.set(userId, gameweekScore);
        } catch (error) {
          console.error(`Error getting score for user ${userId}:`, error);
          gameweekScore = 0;
          userScoreCache.set(userId, 0);
        }
      }

      // Update gameweek scores
      const updatedGameweekScores = { ...gameweekScores };
      updatedGameweekScores[gameweek.toString()] = gameweekScore;

      // Recalculate total
      const totalScore = calculateTotalScore(updatedGameweekScores);

      batch.update(doc.ref, {
        gameweekScores: updatedGameweekScores,
        totalScore,
        lastUpdatedGameweek: Math.max(data.lastUpdatedGameweek || 0, gameweek),
        updatedAt: new Date(),
      });

      batchCount++;
      processed++;

      // Commit batch if size limit reached
      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        console.log(`Committed batch, processed ${processed} documents`);
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(
      `League scores updated for GW${gameweek}: ${processed} processed, ${skipped} skipped`
    );
    return { processed, skipped };
  } catch (error) {
    console.error(
      `Error updating league scores for gameweek ${gameweek}:`,
      error
    );
    throw error;
  }
};

/**
 * Update league scores for a specific league and gameweek
 * @param {string} leagueId - The league ID
 * @param {number} gameweek - The gameweek number
 * @returns {Promise<{processed: number, skipped: number, scores: Array}>}
 */
const updateLeagueScoresForGameweek = async (leagueId, gameweek) => {
  console.log(
    `Updating league scores for league ${leagueId}, gameweek ${gameweek}...`
  );

  try {
    // Get all league scores for this specific league
    const leagueScoresSnapshot = await getLeagueScoresSnapshot(leagueId);

    if (leagueScoresSnapshot.empty) {
      console.log(`No league score documents found for league ${leagueId}`);
      return { processed: 0, skipped: 0, scores: [] };
    }

    let processed = 0;
    let skipped = 0;
    const scores = [];
    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;

    // Get user details for response
    const userIds = leagueScoresSnapshot.docs.map((doc) => doc.data().userId);
    const userMap = await fetchUserDetailsMap(userIds);

    for (const doc of leagueScoresSnapshot.docs) {
      const data = doc.data();
      const { userId, joinedGameweek, gameweekScores = {} } = data;

      // Skip if user joined after this gameweek
      if (gameweek < joinedGameweek) {
        skipped++;
        continue;
      }

      // Get user's score for this gameweek
      let gameweekScore;
      try {
        gameweekScore = await userPredictionsService.getUserGameweekScore(
          userId,
          gameweek
        );
      } catch (error) {
        console.error(`Error getting score for user ${userId}:`, error);
        gameweekScore = 0;
      }

      // Update gameweek scores
      const updatedGameweekScores = { ...gameweekScores };
      updatedGameweekScores[gameweek.toString()] = gameweekScore;

      // Recalculate total
      const totalScore = calculateTotalScore(updatedGameweekScores);

      batch.update(doc.ref, {
        gameweekScores: updatedGameweekScores,
        totalScore,
        lastUpdatedGameweek: Math.max(data.lastUpdatedGameweek || 0, gameweek),
        updatedAt: new Date(),
      });

      const userData = userMap.get(userId) || { name: "Unknown" };
      scores.push({
        userId,
        userName: userData.name,
        gameweekScore,
        totalScore,
        joinedGameweek,
      });

      batchCount++;
      processed++;

      // Commit batch if size limit reached
      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    // Sort scores by total descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    console.log(
      `League ${leagueId} scores updated for GW${gameweek}: ${processed} processed, ${skipped} skipped`
    );
    return { processed, skipped, scores };
  } catch (error) {
    console.error(
      `Error updating league ${leagueId} scores for gameweek ${gameweek}:`,
      error
    );
    throw error;
  }
};

// ============================================
// LEAGUE TABLE QUERIES
// ============================================

/**
 * Get league table with pagination
 * Uses pre-calculated scores for fast retrieval
 * @param {string} leagueId - The league ID
 * @param {number} gameweek - The gameweek to calculate scores up to
 * @param {Object} options - Pagination and user options
 * @returns {Promise<{table: Array, pagination: Object, currentUserEntry: Object|null}>}
 */
const getLeagueTable = async (leagueId, gameweek, options = {}) => {
  const { page = 1, pageSize = 50, currentUserId = null } = options;

  try {
    // Get all league scores for this league
    const leagueScoresSnapshot = await getLeagueScoresSnapshot(leagueId);

    if (leagueScoresSnapshot.empty) {
      return {
        table: [],
        pagination: {
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
        currentUserEntry: null,
      };
    }

    // Collect all user IDs for batch fetching user details
    const userIds = leagueScoresSnapshot.docs.map((doc) => doc.data().userId);
    const userMap = await fetchUserDetailsMap(userIds);

    // Build table entries
    const tableEntries = [];

    for (const doc of leagueScoresSnapshot.docs) {
      const data = doc.data();
      const { userId, gameweekScores = {}, joinedGameweek } = data;

      // Skip users who hadn't joined yet in the selected gameweek
      if (joinedGameweek > gameweek) {
        continue;
      }

      const userData = userMap.get(userId) || { name: "Unknown", email: null };

      // Calculate score up to requested gameweek only
      const scoreUpToGameweek = calculateScoreUpToGameweek(
        gameweekScores,
        joinedGameweek,
        gameweek
      );

      tableEntries.push({
        userId,
        userName: userData.name,
        userEmail: userData.email,
        totalScore: scoreUpToGameweek,
        gameweekScore: gameweekScores[gameweek.toString()] || 0,
        joinedGameweek,
        gameweekScores, // Include for rank change calculation
      });
    }

    // Sort by total score descending, gameweek score as tiebreaker
    tableEntries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return b.gameweekScore - a.gameweekScore;
    });

    // Add rank (handle ties - same score = same rank)
    assignRanks(tableEntries, "totalScore");

    // Calculate previous rank from previous gameweek (for rank change display)
    // This is optional but useful for showing movement
    await calculateRankChanges(tableEntries, leagueId, gameweek);

    // Pagination
    const totalCount = tableEntries.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedTable = tableEntries.slice(startIndex, endIndex);

    // Remove gameweekScores from response (only needed for rank calculation)
    const cleanTable = paginatedTable.map(
      ({ gameweekScores, ...rest }) => rest
    );

    // Find current user's entry if not in current page
    let currentUserEntry = null;
    if (currentUserId) {
      const userInPage = paginatedTable.find((e) => e.userId === currentUserId);
      if (!userInPage) {
        const userEntry = tableEntries.find((e) => e.userId === currentUserId);
        if (userEntry) {
          const userIndex = tableEntries.findIndex(
            (e) => e.userId === currentUserId
          );
          // Remove gameweekScores from currentUserEntry too
          const { gameweekScores, ...cleanUserEntry } = userEntry;
          currentUserEntry = {
            ...cleanUserEntry,
            position: userIndex < startIndex ? "above" : "below",
          };
        }
      }
    }

    return {
      table: cleanTable,
      pagination: {
        page,
        pageSize,
        totalMembers: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        startRank: startIndex + 1,
        endRank: Math.min(endIndex, totalCount),
      },
      currentUserEntry,
    };
  } catch (error) {
    console.error(`Error getting league table for ${leagueId}:`, error);
    throw error;
  }
};

/**
 * Calculate rank changes by comparing with previous gameweek
 * Modifies entries in place to add previousRank and rankChange
 * @param {Array} tableEntries - The current table entries (must include gameweekScores)
 * @param {string} leagueId - The league ID
 * @param {number} gameweek - The current gameweek
 */
const calculateRankChanges = async (tableEntries, leagueId, gameweek) => {
  if (gameweek <= 1) {
    // No previous gameweek to compare
    tableEntries.forEach((entry) => {
      entry.previousRank = null;
      entry.rankChange = 0;
      entry.isNewMember = entry.joinedGameweek === gameweek;
    });
    return;
  }

  // Calculate what ranks would have been in previous gameweek
  const previousGameweek = gameweek - 1;
  const previousRanks = [];

  for (const entry of tableEntries) {
    const { userId, joinedGameweek, gameweekScores = {} } = entry;

    // Skip if user hadn't joined yet in previous gameweek
    if (joinedGameweek > previousGameweek) {
      previousRanks.push({ userId, score: null, isNew: true });
      continue;
    }

    // Calculate score up to previous gameweek using the entry's gameweekScores
    const scoreToPrevGW = calculateScoreUpToGameweek(
      gameweekScores,
      joinedGameweek,
      previousGameweek
    );

    previousRanks.push({ userId, score: scoreToPrevGW, isNew: false });
  }

  // Filter out new members and sort by score descending
  const sortedPrevRanks = previousRanks
    .filter((r) => !r.isNew)
    .sort((a, b) => b.score - a.score);

  // Assign previous ranks (handle ties)
  const prevRankMap = new Map();
  let currentRank = 1;
  sortedPrevRanks.forEach((entry, index) => {
    if (index > 0 && entry.score === sortedPrevRanks[index - 1].score) {
      // Same score as previous entry, same rank
      prevRankMap.set(
        entry.userId,
        prevRankMap.get(sortedPrevRanks[index - 1].userId)
      );
    } else {
      prevRankMap.set(entry.userId, currentRank);
    }
    currentRank++;
  });

  // Apply to table entries
  tableEntries.forEach((entry) => {
    const isNewThisGameweek = entry.joinedGameweek === gameweek;
    const wasNewLastGameweek = entry.joinedGameweek > previousGameweek;

    if (isNewThisGameweek || wasNewLastGameweek) {
      entry.previousRank = null;
      entry.rankChange = 0;
      entry.isNewMember = isNewThisGameweek;
    } else {
      entry.previousRank = prevRankMap.get(entry.userId) || null;
      entry.rankChange = entry.previousRank
        ? entry.previousRank - entry.rank
        : 0;
      entry.isNewMember = false;
    }
  });
};

// ============================================
// GAMEWEEK RANKINGS (for specific gameweek view)
// ============================================

/**
 * Get rankings for a specific gameweek (not cumulative)
 * @param {string} leagueId - The league ID
 * @param {number} gameweek - The gameweek number
 * @returns {Promise<Array>}
 */
const getGameweekRankings = async (leagueId, gameweek) => {
  try {
    const leagueScoresSnapshot = await getLeagueScoresSnapshot(leagueId);

    if (leagueScoresSnapshot.empty) {
      return [];
    }

    // Collect user IDs for batch fetching
    const userIds = leagueScoresSnapshot.docs.map((doc) => doc.data().userId);
    const userMap = await fetchUserDetailsMap(userIds);

    const rankings = [];

    for (const doc of leagueScoresSnapshot.docs) {
      const data = doc.data();
      const { userId, gameweekScores = {}, joinedGameweek } = data;

      // Skip if user hadn't joined yet
      if (joinedGameweek > gameweek) {
        continue;
      }

      const userData = userMap.get(userId) || { name: "Unknown" };
      const gameweekScore = gameweekScores[gameweek.toString()] || 0;

      rankings.push({
        userId,
        userName: userData.name,
        gameweekScore,
        joinedGameweek,
      });
    }

    // Sort by gameweek score descending
    rankings.sort((a, b) => b.gameweekScore - a.gameweekScore);

    // Add rank
    assignRanks(rankings, "gameweekScore");

    return rankings;
  } catch (error) {
    console.error(
      `Error getting gameweek rankings for league ${leagueId}, GW ${gameweek}:`,
      error
    );
    throw error;
  }
};

// ============================================
// MIGRATION & BACKFILL
// ============================================

/**
 * Backfill league scores for all existing leagues
 * Run this once to migrate existing data
 * @param {number} upToGameweek - The gameweek to calculate up to
 * @returns {Promise<{success: boolean, leaguesProcessed: number, membersProcessed: number}>}
 */
const backfillLeagueScores = async (upToGameweek) => {
  console.log(`Backfilling league scores up to gameweek ${upToGameweek}...`);

  try {
    // Get all user-league relationships from users_leagues collection
    const usersLeaguesSnapshot = await db.collection("users_leagues").get();

    if (usersLeaguesSnapshot.empty) {
      console.log("No user-league relationships found");
      return { success: true, leaguesProcessed: 0, membersProcessed: 0 };
    }

    let membersProcessed = 0;
    const leagueIds = new Set();

    for (const doc of usersLeaguesSnapshot.docs) {
      const data = doc.data();
      const { userId, leagueId, league_id, joining_gameweek } = data;

      // Handle both field names (leagueId or league_id)
      const actualLeagueId = leagueId || league_id;
      const joinedGameweek = joining_gameweek || 1;

      if (!userId || !actualLeagueId) {
        console.warn(`Skipping invalid user-league doc: ${doc.id}`);
        continue;
      }

      leagueIds.add(actualLeagueId);

      const scoreDocId = `${actualLeagueId}_${userId}`;
      const scoreDocRef = db.collection("league_scores").doc(scoreDocId);

      // Check if document already exists
      const existingDoc = await scoreDocRef.get();
      if (existingDoc.exists) {
        console.log(`Score doc ${scoreDocId} already exists, updating...`);
      }

      // Calculate scores for each gameweek from join date
      const gameweekScores = {};
      let totalScore = 0;

      for (let gw = joinedGameweek; gw <= upToGameweek; gw++) {
        try {
          const gwScore = await userPredictionsService.getUserGameweekScore(
            userId,
            gw
          );
          gameweekScores[gw.toString()] = gwScore;
          totalScore += gwScore;
        } catch (error) {
          console.error(
            `Error getting score for user ${userId}, GW ${gw}:`,
            error
          );
          gameweekScores[gw.toString()] = 0;
        }
      }

      await scoreDocRef.set({
        leagueId: actualLeagueId,
        userId,
        joinedGameweek,
        totalScore,
        gameweekScores,
        lastUpdatedGameweek: upToGameweek,
        createdAt: existingDoc.exists
          ? existingDoc.data().createdAt
          : new Date(),
        updatedAt: new Date(),
      });

      membersProcessed++;

      if (membersProcessed % 10 === 0) {
        console.log(`Processed ${membersProcessed} member scores...`);
      }
    }

    console.log(
      `Backfill complete: ${membersProcessed} members across ${leagueIds.size} leagues`
    );

    return {
      success: true,
      leaguesProcessed: leagueIds.size,
      membersProcessed,
    };
  } catch (error) {
    console.error("Error backfilling league scores:", error);
    throw error;
  }
};

/**
 * Delete all league score documents (use with caution!)
 * @returns {Promise<{deleted: number}>}
 */
const deleteAllLeagueScores = async () => {
  console.log("Deleting all league score documents...");

  try {
    const snapshot = await db.collection("league_scores").get();

    if (snapshot.empty) {
      return { deleted: 0 };
    }

    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;
    let deleted = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      deleted++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`Deleted ${deleted} league score documents`);
    return { deleted };
  } catch (error) {
    console.error("Error deleting league scores:", error);
    throw error;
  }
};

// ============================================
// USER LEAGUE HISTORY
// ============================================

/**
 * Get a user's score history within a league
 * @param {string} leagueId - The league ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>}
 */
const getUserLeagueHistory = async (leagueId, userId) => {
  try {
    const docId = `${leagueId}_${userId}`;
    const doc = await db.collection("league_scores").doc(docId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    const { gameweekScores = {}, joinedGameweek, totalScore } = data;

    // Convert gameweekScores to array format for easier frontend consumption
    const history = Object.entries(gameweekScores)
      .map(([gw, score]) => ({
        gameweek: parseInt(gw),
        score,
      }))
      .sort((a, b) => a.gameweek - b.gameweek);

    return {
      userId,
      leagueId,
      joinedGameweek,
      totalScore,
      history,
    };
  } catch (error) {
    console.error(
      `Error getting user league history for ${userId} in ${leagueId}:`,
      error
    );
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================

const leagueScores2Service = {
  // Initialization
  initializeUserLeagueScore,
  getUserLeagueScore,

  // Score updates
  updateUserLeagueGameweekScore,
  updateAllLeagueScoresForGameweek,
  updateLeagueScoresForGameweek,

  // Queries
  getLeagueTable,
  getGameweekRankings,
  getUserLeagueHistory,

  // Migration
  backfillLeagueScores,
  deleteAllLeagueScores,
};

export { leagueScores2Service };
export default leagueScores2Service;
