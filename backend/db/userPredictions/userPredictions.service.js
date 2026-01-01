import axios from "axios";
import { db } from "../../firestore.js";
import { scores as scoringRules } from "../constants/scores.js";
import fixturesService from "../fixtures/fixtures.service.js";

// Helper function: calculate score for a single prediction
const calculatePredictionScore = (prediction, fixture) => {
  const score = {
    goals_scored: 0,
    assists: 0,
    correct_scoreline: 0,
  };

  // Check if fixture exists
  if (!fixture) {
    console.warn(
      `No fixture found for prediction ${
        prediction.id || prediction.fixture_id
      }`
    );
    return { score, total_score: 0 };
  }

  // Check if scoreline is correct
  if (
    fixture.team_a_score !== prediction.team_a_score ||
    fixture.team_h_score !== prediction.team_h_score
  ) {
    return { score, total_score: 0 };
  }

  // Correct scoreline - assign base points
  score.correct_scoreline = scoringRules.correct_scoreline || 0;

  // Calculate goals scored and assists from stats
  const currentPredictionStats = Array.isArray(prediction.stats)
    ? prediction.stats
    : [];
  const actualStats = Array.isArray(fixture.stats) ? fixture.stats : [];

  // Goals scored calculation
  const currentPredictionGoalStats = currentPredictionStats.filter(
    (stat) => stat.identifier === "goals_scored"
  );
  const actualGoalStats = actualStats.filter(
    (stat) => stat.identifier === "goals_scored"
  );

  const predictedGoalScorers = currentPredictionGoalStats.map(
    (stat) => stat.element
  );
  const actualGoalScorers = actualGoalStats.map((stat) => stat.element);

  const correctGoalScorers = predictedGoalScorers.filter((playerId) =>
    actualGoalScorers.includes(playerId)
  ).length;

  // Assists calculation
  const currentPredictionAssistStats = currentPredictionStats.filter(
    (stat) => stat.identifier === "assists"
  );
  const actualAssistStats = actualStats.filter(
    (stat) => stat.identifier === "assists"
  );

  const predictedAssisters = currentPredictionAssistStats.map(
    (stat) => stat.element
  );
  const actualAssisters = actualAssistStats.map((stat) => stat.element);

  const correctAssisters = predictedAssisters.filter((playerId) =>
    actualAssisters.includes(playerId)
  ).length;

  // Calculate points
  const goalsScoredPoints =
    Number(scoringRules.goals_scored || scoringRules.goals_sored) || 0;
  const assistsPoints = Number(scoringRules.assists) || 0;

  score.goals_scored = correctGoalScorers * goalsScoredPoints;
  score.assists = correctAssisters * assistsPoints;

  const total_score = Object.values(score).reduce((a, b) => a + b, 0);

  return { score, total_score };
};

// Service: delete all user predictions
const deleteAllUserPredictions = async () => {
  const colRef = db.collection("userPredictions");
  const snap = await colRef.get();
  if (snap.empty) return { deleted: 0 };
  const docs = snap.docs;
  const chunkSize = 400; // keep below 500 write limit
  let deleted = 0;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + chunkSize);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return { deleted };
};

// Service: get a user's predictions document by doc id
const getUserPredictionsById = async (userId, event) => {
  const snap = await db
    .collection("userPredictions")
    .doc(`${userId}_${event}`)
    .get();
  if (!snap.exists) throw new Error("User predictions not found");
  return { id: snap.id, ...snap.data() };
};

// Service: populate predictions by fetching fixtures and writing docs
const populatePredictions = async ({ event, userId }) => {
  if (!process.env.BACKEND_API) {
    throw new Error("BACKEND_API environment variable not defined");
  }

  for (let i = 1; i <= event; i++) {
    const url = `${process.env.BACKEND_API.replace(
      /\/$/,
      ""
    )}/fixtures/?event=${i}`;
    const resp = await axios.get(url, { timeout: 15000 });
    const fixtures = Array.isArray(resp.data)
      ? resp.data
      : resp.data.fixtures || resp.data;
    const identifiersRequired = ["goals_scored", "assists", "own_goals"];
    const predictions = [];
    fixtures.forEach((fixture) => {
      predictions.push({
        id: fixture.id,
        team_a_score: fixture.team_a_score,
        team_h_score: fixture.team_h_score,
        stats: Array.isArray(fixture.stats)
          ? fixture.stats.filter((stat) =>
              identifiersRequired.includes(stat.identifier)
            )
          : [],
      });
    });

    await db.collection("userPredictions").doc(`${userId}_${i}`).set(
      {
        user_id: userId,
        event: i,
        predictions: predictions,
      },
      { merge: true }
    );
  }

  return { status: `Predictions populated for ${event} gameweeks` };
};

// Service: calculate scores for a user's predictions for an event
const calculateScores = async ({ gameweek, userId }) => {
  const docId = `${userId}_${gameweek}`;
  const userPredSnap = await db.collection("userPredictions").doc(docId).get();
  if (!userPredSnap.exists) {
    throw new Error("User predictions not found");
  }
  const userPredData = userPredSnap.data();

  const fixtureResults = await fixturesService.getFixtureById(gameweek);
  console.log("fixtureResult=", fixtureResults);

  // Calculate scores for each prediction using the reusable helper
  const userPredictions = userPredData.predictions.map((pred) => {
    const fixture = fixtureResults.find(
      (f) => f.id === pred.id || f.id === pred.fixture_id
    );
    const { score, total_score } = calculatePredictionScore(pred, fixture);

    return {
      ...pred,
      score,
      total_score, // Note: keeping both total_score and totalScore for backward compatibility
      totalScore: total_score,
    };
  });

  console.log("updated userPredictions=", userPredictions);
  await db.collection("userPredictions").doc(docId).set(
    {
      predictions: userPredictions,
    },
    { merge: true }
  );

  // TODO: Test this and implement own goals
  return { docId, userPredictions };
};

// Service: calculate scores for all users for a specific gameweek
const calculateScoresForAllUsers = async (gameweek) => {
  if (!gameweek) {
    throw new Error("Gameweek is required");
  }

  console.log(
    `Starting score calculation for all users in gameweek ${gameweek}...`
  );

  try {
    // Get all user predictions for this gameweek
    const userPredictionsQuery = await db
      .collection("userPredictions")
      .where("event", "==", parseInt(gameweek))
      .get();

    if (userPredictionsQuery.empty) {
      console.log(`No user predictions found for gameweek ${gameweek}`);
      return {
        gameweek: parseInt(gameweek),
        processedUsers: 0,
        message: `No user predictions found for gameweek ${gameweek}`,
      };
    }

    const userPredictionsDocs = userPredictionsQuery.docs;
    console.log(
      `Found ${userPredictionsDocs.length} user predictions for gameweek ${gameweek}`
    );

    // Get fixture results for this gameweek
    const fixtureResults = await fixturesService.getFixtureById(gameweek);
    console.log(
      `Retrieved ${fixtureResults.length} fixtures for gameweek ${gameweek}`
    );

    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    // Process each user's predictions
    for (const userDoc of userPredictionsDocs) {
      try {
        const userData = userDoc.data();
        const userId = userData.user_id;
        console.log("userData=", userData);
        console.log(`Processing scores for user: ${userId}`);
        console.log("fixtureResults= ", fixtureResults);

        // Calculate scores for this user using the reusable helper
        const userPredictions = userData.predictions || [];
        const updatedPredictions = userPredictions.map((pred) => {
          const fixture = fixtureResults.find(
            (f) => f.id === parseInt(pred.fixture_id)
          );
          const { score, total_score } = calculatePredictionScore(
            pred,
            fixture
          );

          return {
            ...pred,
            score,
            total_score,
          };
        });

        // Calculate total score for the user
        const userTotalScore = updatedPredictions.reduce(
          (total, pred) => total + (pred.total_score || 0),
          0
        );

        // Update user's predictions document with calculated scores
        await userDoc.ref.update({
          predictions: updatedPredictions,
          total_score: userTotalScore,
          scores_calculated_at: new Date(),
          updated_at: new Date(),
        });

        results.push({
          userId,
          totalScore: userTotalScore,
          predictionsProcessed: updatedPredictions.length,
        });

        processedCount++;
        console.log(
          `Completed score calculation for user ${userId}: ${userTotalScore} points`
        );
      } catch (userError) {
        errorCount++;
        console.error(`Error processing user ${userDoc.id}:`, userError);
        results.push({
          userId: userDoc.id,
          error: userError.message,
        });
      }
    }

    console.log(`Score calculation completed for gameweek ${gameweek}:`);
    console.log(`- Processed: ${processedCount} users`);
    console.log(`- Errors: ${errorCount} users`);

    return {
      success: true,
      gameweek: parseInt(gameweek),
      processedUsers: processedCount,
      errorCount,
      totalUsers: userPredictionsDocs.length,
      results,
      message: `Successfully calculated scores for ${processedCount}/${userPredictionsDocs.length} users in gameweek ${gameweek}`,
    };
  } catch (error) {
    console.error(
      `Error calculating scores for all users in gameweek ${gameweek}:`,
      error
    );
    throw new Error(
      `Failed to calculate scores for all users: ${error.message}`
    );
  }
};

// Service: create or update user predictions for a gameweek
const createOrUpdatePredictions = async (userId, gameweek, predictions) => {
  if (!userId || !gameweek || !Array.isArray(predictions)) {
    throw new Error(
      "Invalid parameters: userId, gameweek, and predictions array are required"
    );
  }

  const docId = `${userId}_${gameweek}`;
  const docRef = db.collection("userPredictions").doc(docId);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        // Create new document
        transaction.set(docRef, {
          user_id: userId,
          event: parseInt(gameweek),
          predictions: predictions.map((pred) => ({
            id: pred.fixtureId || pred.id,
            fixture_id: pred.fixtureId || pred.id,
            team_a_score: parseInt(pred.awayScore || pred.team_a_score) || 0,
            team_h_score: parseInt(pred.homeScore || pred.team_h_score) || 0,
            stats: Array.isArray(pred.stats) ? pred.stats : [],
            created_at: new Date(),
            updated_at: new Date(),
          })),
          created_at: new Date(),
          updated_at: new Date(),
        });
      } else {
        // Update existing document
        const existingData = doc.data();
        const existingPredictions = existingData.predictions || [];

        // Create a map for faster lookups
        const existingPredMap = new Map();
        existingPredictions.forEach((pred, index) => {
          const predId = pred.fixture_id || pred.id;
          existingPredMap.set(predId, index);
        });

        // Update or add predictions
        const updatedPredictions = [...existingPredictions];

        predictions.forEach((newPred) => {
          const newPredId = newPred.fixtureId || newPred.id;
          const existingIndex = existingPredMap.get(newPredId);

          if (existingIndex !== undefined) {
            // Update existing prediction, preserving calculated scores
            const existing = updatedPredictions[existingIndex];
            updatedPredictions[existingIndex] = {
              ...existing,
              team_a_score:
                parseInt(newPred.awayScore || newPred.team_a_score) || 0,
              team_h_score:
                parseInt(newPred.homeScore || newPred.team_h_score) || 0,
              stats: Array.isArray(newPred.stats)
                ? newPred.stats
                : existing.stats || [],
              updated_at: new Date(),
              // Preserve existing score and total_score if they exist
            };
          } else {
            // Add new prediction
            updatedPredictions.push({
              id: newPredId,
              fixture_id: newPredId,
              team_a_score:
                parseInt(newPred.awayScore || newPred.team_a_score) || 0,
              team_h_score:
                parseInt(newPred.homeScore || newPred.team_h_score) || 0,
              stats: Array.isArray(newPred.stats) ? newPred.stats : [],
              created_at: new Date(),
              updated_at: new Date(),
            });
          }
        });

        transaction.update(docRef, {
          predictions: updatedPredictions,
          updated_at: new Date(),
        });
      }
    });

    return {
      success: true,
      docId,
      userId,
      gameweek: parseInt(gameweek),
      predictionsCount: predictions.length,
      message: `Successfully saved ${predictions.length} prediction(s) for gameweek ${gameweek}`,
    };
  } catch (error) {
    console.error("Error creating/updating predictions:", error);
    throw new Error(`Failed to save predictions: ${error.message}`);
  }
};

export default {
  deleteAllUserPredictions,
  getUserPredictionsById,
  populatePredictions,
  calculateScores,
  calculateScoresForAllUsers,
  createOrUpdatePredictions,
};
