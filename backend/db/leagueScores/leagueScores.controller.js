import { leagueScoresService } from "./leagueScores.service.js";

const getLeagueTable = async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { gameweek } = req.query;

    if (!leagueId) {
      return res.status(400).json({
        success: false,
        message: "League ID is required",
      });
    }

    const gameweekNum = gameweek ? parseInt(gameweek, 10) : null;
    console.log(`Getting league table for leagueId: ${leagueId}, gameweek: ${gameweekNum}`);

    const leagueTable = await leagueScoresService.getLeagueTable(
      leagueId,
      gameweekNum
    );

    console.log(`League table response:`, JSON.stringify(leagueTable, null, 2));

    res.json({
      success: true,
      data: {
        leagueId,
        gameweek: gameweekNum,
        table: leagueTable,
        memberCount: leagueTable.length,
      },
    });
  } catch (error) {
    console.error("Error fetching league table:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch league table",
      error: error.message,
    });
  }
};

const calculateLeagueScores = async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { gameweek } = req.body;

    if (!leagueId || !gameweek) {
      return res.status(400).json({
        success: false,
        message: "League ID and gameweek are required",
      });
    }

    const scores = await leagueScoresService.calculateLeagueScores(
      leagueId,
      gameweek
    );

    res.json({
      success: true,
      data: {
        leagueId,
        gameweek,
        scores,
        memberCount: scores.length,
      },
    });
  } catch (error) {
    console.error("Error calculating league scores:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate league scores",
      error: error.message,
    });
  }
};

const calculateAllLeagueScores = async (req, res) => {
  try {
    const { gameweek } = req.body;

    if (!gameweek) {
      return res.status(400).json({
        success: false,
        message: "Gameweek is required",
      });
    }

    const results = await leagueScoresService.calculateAllLeagueScores(
      gameweek
    );

    res.json({
      success: true,
      data: {
        gameweek,
        results,
        totalLeagues: results.length,
        successfulLeagues: results.filter((r) => r.success).length,
        failedLeagues: results.filter((r) => !r.success).length,
      },
    });
  } catch (error) {
    console.error("Error calculating all league scores:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate scores for all leagues",
      error: error.message,
    });
  }
};

const getUserLeagueHistory = async (req, res) => {
  try {
    const { leagueId, userId } = req.params;
    const { limit } = req.query;

    if (!leagueId || !userId) {
      return res.status(400).json({
        success: false,
        message: "League ID and User ID are required",
      });
    }

    const limitNum = limit ? parseInt(limit, 10) : 10;
    const history = await leagueScoresService.getUserLeagueHistory(
      userId,
      leagueId,
      limitNum
    );

    res.json({
      success: true,
      data: {
        leagueId,
        userId,
        history,
        recordCount: history.length,
      },
    });
  } catch (error) {
    console.error("Error fetching user league history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user league history",
      error: error.message,
    });
  }
};

const getGameweekRankings = async (req, res) => {
  try {
    const { leagueId, gameweek } = req.params;

    if (!leagueId || !gameweek) {
      return res.status(400).json({
        success: false,
        message: "League ID and gameweek are required",
      });
    }

    const gameweekNum = parseInt(gameweek, 10);
    const rankings = await leagueScoresService.getGameweekRankings(
      leagueId,
      gameweekNum
    );

    res.json({
      success: true,
      data: {
        leagueId,
        gameweek: gameweekNum,
        rankings,
        memberCount: rankings.length,
      },
    });
  } catch (error) {
    console.error("Error fetching gameweek rankings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch gameweek rankings",
      error: error.message,
    });
  }
};

export const leagueScoresController = {
  getLeagueTable,
  calculateLeagueScores,
  calculateAllLeagueScores,
  getUserLeagueHistory,
  getGameweekRankings,
};
