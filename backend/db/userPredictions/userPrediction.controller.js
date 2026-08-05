import userPredService from "./userPredictions.service.js";
import { db } from "../../firestore.js";

const deleteAll = async (req, res) => {
  try {
    const result = await userPredService.deleteAllUserPredictions();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user predictions" });
  }
};

const getUserPredictionsById = async (req, res) => {
  try {
    const { event } = req.body;
    const userId = req.user.id; // Get user ID from JWT token

    console.log("userId=", userId, "\tevent=", event);

    const result = await userPredService.getUserPredictionsById(userId, event);
    res.json(result);
  } catch (err) {
    console.error(err);
    if (err && /not found/i.test(err.message)) {
      return res.status(404).json({ error: "User predictions not found" });
    }
    res.status(500).json({ error: "Failed to get user predictions" });
  }
};

const getUserPredictionsByUserId = async (req, res) => {
  try {
    const { userId, gameweek } = req.params;
    const requestingUserId = req.user.id;

    if (!userId || !gameweek) {
      return res
        .status(400)
        .json({ error: "Both userId and gameweek are required" });
    }

    console.log(
      `User ${requestingUserId} requesting predictions for user ${userId}, gameweek ${gameweek}. ` +
        `Shared leagues: ${req.sharedLeagues?.join(", ") || "N/A"}`
    );

    const result = await userPredService.getUserPredictionsById(
      userId,
      gameweek
    );

    // Remove sensitive information if accessing another user's data
    if (requestingUserId !== userId && result.predictions) {
      // You can filter out sensitive data here if needed
      // For now, we'll return all prediction data since it's league-scoped
    }

    res.json(result);
  } catch (err) {
    console.error(
      `Error fetching predictions for user ${req.params.userId}:`,
      err
    );
    if (err && /not found/i.test(err.message)) {
      return res
        .status(404)
        .json({ error: "User predictions not found for this gameweek" });
    }
    res.status(500).json({ error: "Failed to get user predictions" });
  }
};

const populate = async (req, res) => {
  try {
    const { event, user_id: userId } = req.body;
    const result = await userPredService.populatePredictions({ event, userId });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to populate predictions" });
  }
};

const calculate = async (req, res) => {
  try {
    const { gameweek, user_id: userId } = req.body;
    const result = await userPredService.calculateScores({ gameweek, userId });
    res.json(result);
  } catch (err) {
    console.error(err);
    if (err && /not found/i.test(err.message)) {
      return res.status(404).json({ error: "User predictions not found" });
    }
    res.status(500).json({ error: "Failed to calculate scores" });
  }
};

const calculateAllUsersScores = async (req, res) => {
  try {
    const { gameweek } = req.body;

    if (!gameweek) {
      return res.status(400).json({ error: "Gameweek is required" });
    }

    console.log(
      `Starting score calculation for all users in gameweek ${gameweek}`
    );

    const result = await userPredService.calculateScoresForAllUsers(gameweek);

    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error calculating scores for all users:", err);
    res.status(500).json({
      error: "Failed to calculate scores for all users",
      details: err.message,
      gameweek: req.body.gameweek,
    });
  }
};

const createOrUpdatePredictions = async (req, res) => {
  try {
    const { predictions, gameweek } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({ error: "Predictions array is required" });
    }

    const parsedGameweek = Number(gameweek);
    if (
      !Number.isInteger(parsedGameweek) ||
      parsedGameweek < 1 ||
      parsedGameweek > 38
    ) {
      return res
        .status(400)
        .json({ error: "Gameweek must be an integer from 1 to 38" });
    }

    if (predictions.length > 20) {
      return res.status(400).json({
        error: "A gameweek cannot contain more than 20 predictions",
      });
    }

    const fixtureIds = new Set();
    for (const prediction of predictions) {
      const fixtureId = prediction.fixtureId ?? prediction.id;
      const homeScore = prediction.homeScore ?? prediction.team_h_score;
      const awayScore = prediction.awayScore ?? prediction.team_a_score;

      if (fixtureId === undefined || fixtureId === null || fixtureId === "") {
        return res.status(400).json({ error: "Every prediction requires a fixture ID" });
      }
      if (fixtureIds.has(String(fixtureId))) {
        return res
          .status(400)
          .json({ error: `Duplicate fixture ID: ${fixtureId}` });
      }
      fixtureIds.add(String(fixtureId));

      if (
        !Number.isInteger(Number(homeScore)) ||
        !Number.isInteger(Number(awayScore)) ||
        Number(homeScore) < 0 ||
        Number(awayScore) < 0 ||
        Number(homeScore) > 20 ||
        Number(awayScore) > 20
      ) {
        return res.status(400).json({
          error: "Prediction scores must be whole numbers from 0 to 20",
        });
      }
    }

    // Validate captain selection: only one captain allowed per gameweek
    const captainPredictions = predictions.filter(
      (pred) => pred.captain === true
    );

    if (captainPredictions.length > 1) {
      return res.status(400).json({
        error: "Only one captain allowed per gameweek",
        captainCount: captainPredictions.length,
      });
    }

    const result = await userPredService.createOrUpdatePredictions(
      userId,
      parsedGameweek,
      predictions
    );

    return res.status(201).json(result);
  } catch (err) {
    console.error("Error in createOrUpdatePredictions controller:", err);
    if (err.message.includes("deadline")) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message.includes("No scheduled fixtures")) {
      return res.status(400).json({ error: err.message });
    }
    return res
      .status(500)
      .json({ error: "Failed to create or update predictions" });
  }
};

export default {
  deleteAll,
  getUserPredictionsById,
  getUserPredictionsByUserId,
  populate,
  calculate,
  calculateAllUsersScores,
  createOrUpdatePredictions,
};
