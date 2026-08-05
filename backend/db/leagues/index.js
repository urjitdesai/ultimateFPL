import express from "express";
import { leaguesController } from "./leagues.controller.js";
import { leagueScores2Controller } from "../leagueScores/leagueScores2.controller.js";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/admin.js";
import { verifyLeagueMembership } from "../../middleware/leagueAccess.js";

const router = express.Router();

// Protected routes that require authentication
router.post("/create", authenticateToken, leaguesController.createLeague);
router.post(
  "/user-leagues",
  authenticateToken,
  leaguesController.getUserLeagues
);
router.post("/join", authenticateToken, leaguesController.joinLeague);

// Admin routes for creating default leagues
router.post(
  "/create-default-team-leagues",
  authenticateToken,
  requireAdmin,
  leaguesController.createDefaultTeamLeagues
);
router.post(
  "/create-gameweek-league",
  authenticateToken,
  requireAdmin,
  leaguesController.createDefaultGameweekLeague
);

// League scores routes (v2 - league-specific scores)
router.get(
  "/:leagueId/table",
  authenticateToken,
  verifyLeagueMembership(),
  leagueScores2Controller.getLeagueTable
);
router.get(
  "/:leagueId/gameweek/:gameweek",
  authenticateToken,
  verifyLeagueMembership(),
  leagueScores2Controller.getGameweekRankings
);
router.get(
  "/:leagueId/history/:userId",
  authenticateToken,
  verifyLeagueMembership(),
  leagueScores2Controller.getUserLeagueHistory
);

// Admin routes for score management
router.post(
  "/scores/update-gameweek",
  authenticateToken,
  requireAdmin,
  leagueScores2Controller.updateLeagueScoresForGameweek
);
router.post(
  "/scores/backfill",
  authenticateToken,
  requireAdmin,
  leagueScores2Controller.backfillLeagueScores
);
router.post(
  "/scores/initialize",
  authenticateToken,
  requireAdmin,
  leagueScores2Controller.initializeUserLeagueScore
);
router.delete(
  "/scores/delete-all",
  authenticateToken,
  requireAdmin,
  leagueScores2Controller.deleteAllLeagueScores
);

// Legacy routes (keeping for backward compatibility)
router.post(
  "/:leagueId/calculate",
  authenticateToken,
  requireAdmin,
  leagueScores2Controller.calculateLeagueScores
);
router.post(
  "/calculate-all",
  authenticateToken,
  requireAdmin,
  leagueScores2Controller.updateLeagueScoresForGameweek
);

// Public routes
router.get(
  "/:id",
  authenticateToken,
  verifyLeagueMembership("id"),
  leaguesController.getLeagueById,
);
router.get("/", authenticateToken, requireAdmin, leaguesController.getAllLeagues);

export default router;
