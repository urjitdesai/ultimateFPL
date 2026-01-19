import leagueScores2Service from "./leagueScores2.service.js";

/**
 * League Scores Controller v2
 * Uses leagueScores2.service.js for league-specific score calculations
 */

const getLeagueTable = async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { gameweek, page, pageSize } = req.query;
    const currentUserId = req.user?.id;

    if (!leagueId) {
      return res.status(400).json({
        success: false,
        message: "League ID is required",
      });
    }

    const gameweekNum = gameweek ? parseInt(gameweek, 10) : null;
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 50;

    console.log(
      `[v2] Getting league table for leagueId: ${leagueId}, gameweek: ${gameweekNum}, page: ${pageNum}, pageSize: ${pageSizeNum}, currentUserId: ${currentUserId}`
    );

    const result = await leagueScores2Service.getLeagueTable(
      leagueId,
      gameweekNum,
      { page: pageNum, pageSize: pageSizeNum, currentUserId }
    );

    console.log(
      `[v2] League table response: ${result.table.length} members, pagination:`,
      result.pagination
    );

    res.json({
      success: true,
      data: {
        leagueId,
        gameweek: gameweekNum,
        table: result.table,
        pagination: result.pagination,
        currentUserEntry: result.currentUserEntry,
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
    const rankings = await leagueScores2Service.getGameweekRankings(
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

const getUserLeagueHistory = async (req, res) => {
  try {
    const { leagueId, userId } = req.params;

    if (!leagueId || !userId) {
      return res.status(400).json({
        success: false,
        message: "League ID and User ID are required",
      });
    }

    const history = await leagueScores2Service.getUserLeagueHistory(
      leagueId,
      userId
    );

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "User not found in this league",
      });
    }

    res.json({
      success: true,
      data: history,
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

/**
 * Calculate/update scores for a specific league and gameweek
 * Called when user clicks "Calculate GW" button on league details page
 */
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

    const gameweekNum = parseInt(gameweek, 10);

    console.log(
      `[v2] Calculating league scores for league ${leagueId}, gameweek ${gameweekNum}...`
    );

    const result = await leagueScores2Service.updateLeagueScoresForGameweek(
      leagueId,
      gameweekNum
    );

    res.json({
      success: true,
      data: {
        leagueId,
        gameweek: gameweekNum,
        processed: result.processed,
        skipped: result.skipped,
        scores: result.scores,
        memberCount: result.scores.length,
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

const updateLeagueScoresForGameweek = async (req, res) => {
  try {
    const { gameweek } = req.body;

    if (!gameweek) {
      return res.status(400).json({
        success: false,
        message: "Gameweek is required",
      });
    }

    const gameweekNum = parseInt(gameweek, 10);

    console.log(`[v2] Updating league scores for gameweek ${gameweekNum}...`);

    const result = await leagueScores2Service.updateAllLeagueScoresForGameweek(
      gameweekNum
    );

    res.json({
      success: true,
      data: {
        gameweek: gameweekNum,
        processed: result.processed,
        skipped: result.skipped,
      },
    });
  } catch (error) {
    console.error("Error updating league scores:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update league scores",
      error: error.message,
    });
  }
};

const backfillLeagueScores = async (req, res) => {
  try {
    const { gameweek } = req.body;

    if (!gameweek) {
      return res.status(400).json({
        success: false,
        message: "Gameweek is required",
      });
    }

    const gameweekNum = parseInt(gameweek, 10);

    console.log(
      `[v2] Backfilling league scores up to gameweek ${gameweekNum}...`
    );

    const result = await leagueScores2Service.backfillLeagueScores(gameweekNum);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error backfilling league scores:", error);
    res.status(500).json({
      success: false,
      message: "Failed to backfill league scores",
      error: error.message,
    });
  }
};

const deleteAllLeagueScores = async (req, res) => {
  try {
    console.log("[v2] Deleting all league scores...");

    const result = await leagueScores2Service.deleteAllLeagueScores();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error deleting league scores:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete league scores",
      error: error.message,
    });
  }
};

const initializeUserLeagueScore = async (req, res) => {
  try {
    const { leagueId, userId, joinedGameweek } = req.body;

    if (!leagueId || !userId || !joinedGameweek) {
      return res.status(400).json({
        success: false,
        message: "leagueId, userId, and joinedGameweek are required",
      });
    }

    const result = await leagueScores2Service.initializeUserLeagueScore(
      leagueId,
      userId,
      parseInt(joinedGameweek, 10)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error initializing user league score:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initialize user league score",
      error: error.message,
    });
  }
};

export const leagueScores2Controller = {
  getLeagueTable,
  getGameweekRankings,
  getUserLeagueHistory,
  calculateLeagueScores,
  updateLeagueScoresForGameweek,
  backfillLeagueScores,
  deleteAllLeagueScores,
  initializeUserLeagueScore,
};

export default leagueScores2Controller;
