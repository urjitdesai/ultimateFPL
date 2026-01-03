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

    if (!gameweek) {
      return res.status(400).json({ error: "Gameweek is required" });
    }

    // Validate captain selection: only one captain allowed per gameweek
    const captainPredictions = predictions.filter(
      (pred) => pred.captain === true
    );

    if (captainPredictions.length > 0) {
      console.log("Captain prediction details:", captainPredictions);
    }

    if (captainPredictions.length > 1) {
      return res.status(400).json({
        error: "Only one captain allowed per gameweek",
        captainCount: captainPredictions.length,
      });
    }

    const result = await userPredService.createOrUpdatePredictions(
      userId,
      gameweek,
      predictions
    );

    res.status(201).json(result);
  } catch (err) {
    console.error("Error in createOrUpdatePredictions controller:", err);
    res.status(500).json({
      error: "Failed to create or update predictions",
      details: err.message,
    });
  }
};

export default {
  deleteAll,
  getUserPredictionsById,
  populate,
  calculate,
  calculateAllUsersScores,
  createOrUpdatePredictions,
};
