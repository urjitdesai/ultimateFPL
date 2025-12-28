import axios from "axios";
import { db } from "../../firestore.js";
import { scores as scoringRules } from "../constants/scores.js";
import fixturesService from "../fixtures/fixtures.service.js";

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
const calculateScores = async ({ event, userId }) => {
  const docId = `${userId}_${event}`;
  const userPredSnap = await db.collection("userPredictions").doc(docId).get();
  if (!userPredSnap.exists) {
    throw new Error("User predictions not found");
  }
  const userPredData = userPredSnap.data();

  // Minimal scoring placeholder: return zeros for known score keys

  const fixtureResult = await fixturesService.getFixtureById(event);
  console.log("fixtureResult=", fixtureResult);

  // A real implementation would iterate over userPredData.predictions and apply scoringRules
  const userPredictions = userPredData.predictions;
  userPredictions.forEach((pred) => {
    const score = {
      goals_scored: 0,
      assists: 0,
      correct_scoreline: 0,
    };
    // get corresponding fixture
    const fixture = fixtureResult.find((f) => f.id === pred.id);
    if (
      fixture.team_a_score !== pred.team_a_score ||
      fixture.team_h_score !== pred.team_h_score
    ) {
      pred.score = score; // attach score to this prediction
      pred.total_score = Object.values(score).reduce((a, b) => a + b, 0);
      return; // no points if scoreline is wrong
    }
    // correct scoreline - assign base points
    score.correct_scoreline = scoringRules.correct_scoreline;

    // calculate goals scored and assists from stats
    const currentPredictionStats = Array.isArray(pred.stats) ? pred.stats : [];
    const actualStats = Array.isArray(fixture.stats) ? fixture.stats : [];
    const currentPredictionGoalScoredStats = currentPredictionStats.filter(
      (stat) => stat.identifier === "goals_scored"
    );
    const actualGoalScoredStats = actualStats.filter(
      (stat) => stat.identifier === "goals_scored"
    );
    const currentPredictedGoalScorers = currentPredictionGoalScoredStats.map(
      (stat) => stat.element
    );
    const actualGoalScorers = actualGoalScoredStats.map((stat) => stat.element);

    // goals scored
    const goalsScorersPredictedCorrectly = currentPredictedGoalScorers.filter(
      (playerId) => actualGoalScorers.includes(playerId)
    ).length;

    // calculate assists
    const currentPredictionAssistStats = currentPredictionStats.filter(
      (stat) => stat.identifier === "assists"
    );
    const actualAssistStats = actualStats.filter(
      (stat) => stat.identifier === "assists"
    );
    const currentPredictedAssisters = currentPredictionAssistStats.map(
      (stat) => stat.element
    );
    const actualAssisters = actualAssistStats.map((stat) => stat.element);
    const assistsPredictedCorrectly = currentPredictedAssisters.filter(
      (playerId) => actualAssisters.includes(playerId)
    ).length;

    // defensively coerce scoring rules to numbers and provide defaults
    const goalsScoredPoints =
      Number(scoringRules.goals_scored || scoringRules.goals_sored) || 0;
    const assistsPoints = Number(scoringRules.assists) || 0;

    score.goals_scored =
      (Number(goalsScorersPredictedCorrectly) || 0) * goalsScoredPoints;
    score.assists = (Number(assistsPredictedCorrectly) || 0) * assistsPoints;

    pred.score = score;
    pred.totalScore = Object.values(score).reduce((a, b) => a + b, 0);
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
  createOrUpdatePredictions,
};
