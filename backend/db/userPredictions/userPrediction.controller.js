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
    const { user_id, event } = req.body;
    console.log("userId=", user_id, "\tevent=", event);

    const result = await userPredService.getUserPredictionsById(user_id, event);
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
    const { event, user_id: userId } = req.body;
    const result = await userPredService.calculateScores({ event, userId });
    res.json(result);
  } catch (err) {
    console.error(err);
    if (err && /not found/i.test(err.message)) {
      return res.status(404).json({ error: "User predictions not found" });
    }
    res.status(500).json({ error: "Failed to calculate scores" });
  }
};

export default {
  deleteAll,
  getUserPredictionsById,
  populate,
  calculate,
};
