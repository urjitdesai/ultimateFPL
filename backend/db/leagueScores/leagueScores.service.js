import { db } from "../../firestore.js";
import { userPredictionsService } from "../userPredictions/userPredictions.service.js";
import fixturesService from "../fixtures/fixtures.service.js";

const calculateLeagueScores = async (leagueId, gameweek) => {
  console.log(
    `Calculating league scores for league ${leagueId}, gameweek ${gameweek}`
  );

  try {
    // 1. Get all league members
    const membersSnapshot = await db
      .collection("users_leagues")
      .where("league_id", "==", leagueId)
      .get();

    if (membersSnapshot.empty) {
      console.log(`No members found in league ${leagueId}`);
      return [];
    }

    const members = membersSnapshot.docs.map((doc) => ({
      userId: doc.data().userId,
      joinedGameweek: doc.data().joining_gameweek || 1,
    }));

    console.log("league members= ", members);

    // 2. Get previous gameweek rankings for position change calculation
    const previousRankings = await getGameweekRankings(leagueId, gameweek - 1);
    console.log("previousRankings=", previousRankings);

    // 3. Calculate scores for each member
    const memberScores = [];

    for (const member of members) {
      // Skip if user joined after this gameweek
      if (member.joinedGameweek > gameweek) {
        continue;
      }

      try {
        // Get user's gameweek score
        const gameweekScore = await userPredictionsService.getUserGameweekScore(
          member.userId,
          gameweek
        );

        // Get user's total score up to this gameweek
        const totalScore = await getUserTotalScore(member.userId, gameweek);

        memberScores.push({
          userId: member.userId,
          gameweekScore: gameweekScore || 0,
          totalScore: totalScore || 0,
        });
      } catch (error) {
        console.error(
          `Error calculating score for user ${member.userId}:`,
          error
        );
        // Include user with 0 score to maintain league consistency
        memberScores.push({
          userId: member.userId,
          gameweekScore: 0,
          totalScore: 0,
        });
      }
    }

    // 4. Rank users by total score (descending)
    const rankedScores = memberScores
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((score, index) => ({
        ...score,
        rank: index + 1,
      }));

    // 5. Calculate position changes
    const scoresWithChanges = calculatePositionChanges(
      rankedScores,
      previousRankings
    );

    // 6. Save scores to database
    await saveLeagueScores(leagueId, gameweek, scoresWithChanges);

    console.log(
      `Successfully calculated scores for ${scoresWithChanges.length} members in league ${leagueId}`
    );
    return scoresWithChanges;
  } catch (error) {
    console.error(
      `Error calculating league scores for league ${leagueId}:`,
      error
    );
    throw error;
  }
};

const calculatePositionChanges = (currentRankings, previousRankings) => {
  return currentRankings.map((current) => {
    const previous = previousRankings.find((p) => p.userId === current.userId);
    const previousRank = previous ? previous.rank : null;

    let rankChange = 0;
    let isNewMember = false;

    if (previousRank === null) {
      isNewMember = true;
    } else {
      // Positive = moved up, Negative = moved down, 0 = no change
      rankChange = previousRank - current.rank;
    }

    return {
      ...current,
      previousRank,
      rankChange,
      isNewMember,
    };
  });
};

const getUserTotalScore = async (userId, gameweek) => {
  try {
    // Get all user predictions up to this gameweek
    const predictionsSnapshot = await db
      .collection("userPredictions")
      .where("user_id", "==", userId)
      .where("event", "<=", gameweek)
      .get();

    let totalScore = 0;

    for (const doc of predictionsSnapshot.docs) {
      const predictionData = doc.data();
      if (predictionData.total_score !== undefined) {
        totalScore += predictionData.total_score;
      }
    }

    console.log(`Total calculated score for user ${userId}: ${totalScore}`);
    return totalScore;
  } catch (error) {
    console.error(`Error getting total score for user ${userId}:`, error);
    return 0;
  }
};

const saveLeagueScores = async (leagueId, gameweek, scores) => {
  const batch = db.batch();

  for (const score of scores) {
    const docId = `${leagueId}_${score.userId}_${gameweek}`;
    const docRef = db.collection("league_scores").doc(docId);

    batch.set(docRef, {
      leagueId,
      userId: score.userId,
      gameweek,
      gameweekScore: score.gameweekScore,
      totalScore: score.totalScore,
      rank: score.rank,
      previousRank: score.previousRank,
      rankChange: score.rankChange,
      isNewMember: score.isNewMember,
      calculatedAt: new Date(),
    });
  }

  await batch.commit();
};

const getGameweekRankings = async (leagueId, gameweek) => {
  console.log(
    "Getting gameweek rankings for league:",
    leagueId,
    "gameweek:",
    gameweek
  );

  if (gameweek < 1) return [];

  try {
    const rankingsSnapshot = await db
      .collection("league_scores")
      .where("leagueId", "==", leagueId)
      .where("gameweek", "==", gameweek)
      .orderBy("rank")
      .get();

    return rankingsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        userId: data.userId,
        rank: data.rank,
        totalScore: data.totalScore,
        gameweekScore: data.gameweekScore,
      };
    });
  } catch (error) {
    console.error(
      `Error getting gameweek rankings for league ${leagueId}, gameweek ${gameweek}:`,
      error
    );
    return [];
  }
};

const getLeagueTable = async (leagueId, gameweek = null) => {
  try {
    // If no gameweek specified, get the latest available
    if (!gameweek) {
      gameweek = await getLatestCalculatedGameweek(leagueId);
      if (!gameweek) {
        return [];
      }
    }

    const scoresSnapshot = await db
      .collection("league_scores")
      .where("leagueId", "==", leagueId)
      .where("gameweek", "==", gameweek)
      .orderBy("rank")
      .get();

    const scores = [];

    for (const doc of scoresSnapshot.docs) {
      const scoreData = doc.data();

      // Get user details
      const userDoc = await db.collection("users").doc(scoreData.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      scores.push({
        userId: scoreData.userId,
        userName: userData.display_name || userData.email || "Unknown User",
        userEmail: userData.email,
        rank: scoreData.rank,
        previousRank: scoreData.previousRank,
        rankChange: scoreData.rankChange,
        gameweekScore: scoreData.gameweekScore,
        totalScore: scoreData.totalScore,
        isNewMember: scoreData.isNewMember || false,
        calculatedAt: scoreData.calculatedAt,
      });
    }

    return scores;
  } catch (error) {
    console.error(`Error getting league table for league ${leagueId}:`, error);
    throw error;
  }
};

const getLatestCalculatedGameweek = async (leagueId) => {
  try {
    const latestSnapshot = await db
      .collection("league_scores")
      .where("leagueId", "==", leagueId)
      .orderBy("gameweek", "desc")
      .limit(1)
      .get();

    if (latestSnapshot.empty) {
      return null;
    }

    return latestSnapshot.docs[0].data().gameweek;
  } catch (error) {
    console.error(
      `Error getting latest gameweek for league ${leagueId}:`,
      error
    );
    return null;
  }
};

const getUserLeagueHistory = async (userId, leagueId, limit = 10) => {
  try {
    const historySnapshot = await db
      .collection("league_scores")
      .where("leagueId", "==", leagueId)
      .where("userId", "==", userId)
      .orderBy("gameweek", "desc")
      .limit(limit)
      .get();

    return historySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        gameweek: data.gameweek,
        rank: data.rank,
        previousRank: data.previousRank,
        rankChange: data.rankChange,
        gameweekScore: data.gameweekScore,
        totalScore: data.totalScore,
        isNewMember: data.isNewMember || false,
        calculatedAt: data.calculatedAt,
      };
    });
  } catch (error) {
    console.error(
      `Error getting user league history for ${userId} in league ${leagueId}:`,
      error
    );
    throw error;
  }
};

// Calculate scores for all leagues after a gameweek completes
const calculateAllLeagueScores = async (gameweek) => {
  console.log(`Starting calculation for all leagues, gameweek ${gameweek}`);

  try {
    // Get all leagues
    const leaguesSnapshot = await db.collection("leagues").get();
    const results = [];

    for (const leagueDoc of leaguesSnapshot.docs) {
      try {
        const leagueId = leagueDoc.id;
        const leagueData = leagueDoc.data();

        console.log(
          `Calculating scores for league: ${leagueData.name} (${leagueId})`
        );

        const scores = await calculateLeagueScores(leagueId, gameweek);
        results.push({
          leagueId,
          leagueName: leagueData.name,
          memberCount: scores.length,
          success: true,
        });
      } catch (error) {
        console.error(
          `Error calculating scores for league ${leagueDoc.id}:`,
          error
        );
        results.push({
          leagueId: leagueDoc.id,
          leagueName: leagueDoc.data().name,
          error: error.message,
          success: false,
        });
      }
    }

    console.log(`Completed calculation for ${results.length} leagues`);
    return results;
  } catch (error) {
    console.error("Error calculating scores for all leagues:", error);
    throw error;
  }
};

export const leagueScoresService = {
  calculateLeagueScores,
  calculateAllLeagueScores,
  getLeagueTable,
  getGameweekRankings,
  getUserLeagueHistory,
  getLatestCalculatedGameweek,
};
