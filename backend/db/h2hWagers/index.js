import express from "express";
import { h2hWagersController } from "./h2hWagers.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Place or update a wager on a fixture
// POST /api/h2h/:leagueId/wager
router.post("/:leagueId/wager", h2hWagersController.placeWager);

// Get current user's wagers + cap summary for a gameweek
// GET /api/h2h/:leagueId/wagers/:gameweek
router.get(
  "/:leagueId/wagers/:gameweek",
  h2hWagersController.getMyWagersForGameweek,
);

// Get all wagers for a specific fixture in a league
// GET /api/h2h/:leagueId/fixture/:fixtureId/wagers
router.get(
  "/:leagueId/fixture/:fixtureId/wagers",
  h2hWagersController.getWagersForFixture,
);

// Get H2H league table
// GET /api/h2h/:leagueId/table
router.get("/:leagueId/table", h2hWagersController.getH2HLeagueTable);

// Resolve all wagers for a completed gameweek (admin/cron)
// POST /api/h2h/:leagueId/resolve/:gameweek
router.post(
  "/:leagueId/resolve/:gameweek",
  h2hWagersController.resolveGameweekWagers,
);

// Void unmatched wagers at fixture kickoff (admin/cron)
// POST /api/h2h/:leagueId/void-unmatched/:fixtureId/:gameweek
router.post(
  "/:leagueId/void-unmatched/:fixtureId/:gameweek",
  h2hWagersController.voidUnmatchedWagers,
);

export default router;
