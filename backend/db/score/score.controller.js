import scoreService from "./score.service.js";
import { db } from "../../firestore.js";

// GET /api/score/user/:userId/gameweek/:gameweek
const getUserGameweekScore = async (req, res) => {
  console.log("in getUserGameweekScore controller");

  const { userId, gameweek } = req.params;

  if (!userId || !gameweek) {
    return res.status(400).json({ error: "userId and gameweek are required" });
  }

  try {
    const result = await scoreService.getUserGameweekScore(
      userId,
      parseInt(gameweek)
    );
    res.json({
      userId,
      gameweek: parseInt(gameweek),
      score: result,
    });
  } catch (err) {
    console.error("Error getting user gameweek score:", err);
    res.status(500).json({ error: "Failed to get user gameweek score" });
  }
};

// GET /api/score/user/:userId/total
const getUserTotalScore = async (req, res) => {
  console.log("in getUserTotalScore controller");

  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const result = await scoreService.getUserTotalScore(userId);
    res.json({
      userId,
      totalScore: result.totalScore,
      gameweekScores: result.gameweekScores,
    });
  } catch (err) {
    console.error("Error getting user total score:", err);
    res.status(500).json({ error: "Failed to get user total score" });
  }
};

export default {
  getUserGameweekScore,
  getUserTotalScore,
};
