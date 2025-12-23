import { db } from "../../firestore.js";

// Get score for a specific user and gameweek
const getUserGameweekScore = async (userId, gameweek) => {
  try {
    console.log(`Getting score for user ${userId}, gameweek ${gameweek}`);

    // Query the scores collection for the specific user and gameweek
    const scoreQuery = await db
      .collection("scores")
      .where("userId", "==", userId)
      .where("gameweek", "==", gameweek)
      .get();

    if (scoreQuery.empty) {
      // If no score document exists, return 0 (user hasn't been scored yet)
      return {
        score: 0,
        exists: false,
        message: "No score found for this gameweek",
      };
    }

    // Assuming there's only one score document per user per gameweek
    const scoreDoc = scoreQuery.docs[0];
    const scoreData = scoreDoc.data();

    return {
      score: scoreData.score || 0,
      exists: true,
      scoredAt: scoreData.scoredAt,
      details: scoreData.details || null,
    };
  } catch (error) {
    console.error("Error in getUserGameweekScore service:", error);
    throw new Error("Failed to fetch user gameweek score");
  }
};

// Get total score for a user across all gameweeks
const getUserTotalScore = async (userId) => {
  try {
    console.log(`Getting total score for user ${userId}`);

    // Query all score documents for the user
    const scoresQuery = await db
      .collection("userPredictions")
      .where("user_id", "==", userId)
      .get();

    if (scoresQuery.empty) {
      return {
        totalScore: 0,
        gameweekScores: [],
        message: "No scores found for this user",
      };
    }

    let totalScore = 0;
    scoresQuery.docs.forEach((doc) => {
      const docData = doc.data();
      const predictions = docData.predictions || [];
      predictions.forEach((pred) => {
        totalScore += pred.total_score || 0;
      });

      totalScore += gameweekScore;
    });

    return {
      totalScore,
    };
  } catch (error) {
    console.error("Error in getUserTotalScore service:", error);
    throw new Error("Failed to fetch user total score");
  }
};

export default {
  getUserGameweekScore,
  getUserTotalScore,
};
