import { h2hWagersService } from "./h2hWagers.service.js";

/**
 * POST /api/h2h/:leagueId/wager
 * Place or update a wager on a fixture
 */
export const placeWager = async (req, res) => {
  const userId = req.user.id;
  const { leagueId } = req.params;
  const { fixtureId, gameweek, outcome, amount } = req.body;

  if (!fixtureId || !gameweek || !outcome || amount === undefined) {
    return res.status(400).json({
      success: false,
      error: "fixtureId, gameweek, outcome, and amount are required.",
    });
  }

  if (!Number.isInteger(Number(amount))) {
    return res.status(400).json({
      success: false,
      error: "Amount must be a whole number.",
    });
  }

  try {
    const result = await h2hWagersService.placeWager({
      leagueId,
      userId,
      fixtureId: Number(fixtureId),
      gameweek: Number(gameweek),
      outcome,
      amount: Number(amount),
    });

    return res.status(200).json({
      success: true,
      message: "Wager placed successfully.",
      wager: result,
    });
  } catch (error) {
    console.error("Error placing H2H wager:", error);
    const status =
      error.message.includes("deadline") ||
      error.message.includes("Invalid") ||
      error.message.includes("cap")
        ? 400
        : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/h2h/:leagueId/wagers/:gameweek
 * Get current user's wagers for a gameweek in a league
 */
export const getMyWagersForGameweek = async (req, res) => {
  const userId = req.user.id;
  const { leagueId, gameweek } = req.params;

  try {
    const summary = await h2hWagersService.getUserGameweekWagerSummary(
      leagueId,
      userId,
      Number(gameweek),
    );
    return res.status(200).json({ success: true, ...summary });
  } catch (error) {
    console.error("Error fetching H2H wagers:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/h2h/:leagueId/fixture/:fixtureId/wagers
 * Get all wagers for a specific fixture (useful for league view)
 */
export const getWagersForFixture = async (req, res) => {
  const { leagueId, fixtureId } = req.params;

  try {
    const wagers = await h2hWagersService.getWagersForFixture(
      leagueId,
      Number(fixtureId),
    );
    return res.status(200).json({ success: true, wagers });
  } catch (error) {
    console.error("Error fetching fixture wagers:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/h2h/:leagueId/table
 * Get H2H league table
 */
export const getH2HLeagueTable = async (req, res) => {
  const { leagueId } = req.params;

  try {
    const table = await h2hWagersService.getH2HLeagueTable(leagueId);
    return res.status(200).json({ success: true, table });
  } catch (error) {
    console.error("Error fetching H2H league table:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/h2h/:leagueId/resolve/:gameweek
 * Resolve all wagers for a completed gameweek (admin/cron)
 */
export const resolveGameweekWagers = async (req, res) => {
  const { leagueId, gameweek } = req.params;

  try {
    const result = await h2hWagersService.resolveGameweekWagers(
      leagueId,
      Number(gameweek),
    );
    return res.status(200).json({
      success: true,
      message: `Gameweek ${gameweek} wagers resolved.`,
      ...result,
    });
  } catch (error) {
    console.error("Error resolving H2H wagers:", error);
    const status = error.message.includes("not finished") ? 400 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/h2h/:leagueId/void-unmatched/:fixtureId/:gameweek
 * Void unmatched wagers at kickoff (admin/cron)
 */
export const voidUnmatchedWagers = async (req, res) => {
  const { leagueId, fixtureId, gameweek } = req.params;

  try {
    const result = await h2hWagersService.voidUnmatchedWagersForFixture(
      leagueId,
      Number(fixtureId),
      Number(gameweek),
    );
    return res.status(200).json({
      success: true,
      message: "Unmatched wagers voided.",
      ...result,
    });
  } catch (error) {
    console.error("Error voiding unmatched wagers:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const h2hWagersController = {
  placeWager,
  getMyWagersForGameweek,
  getWagersForFixture,
  getH2HLeagueTable,
  resolveGameweekWagers,
  voidUnmatchedWagers,
};
