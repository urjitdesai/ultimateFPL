import express from "express";
import scoreController from "./score.controller.js";
import { authenticateToken } from "../../middleware/auth.js";
import { verifySharedLeagueMembership } from "../../middleware/leagueAccess.js";
const router = express.Router();

router.use(authenticateToken);

// GET /api/score/user/:userId/gameweek/:gameweek - get score for a specific user and gameweek
router.get(
  "/user/:userId/gameweek/:gameweek",
  verifySharedLeagueMembership,
  scoreController.getUserGameweekScore
);

// GET /api/score/user/:userId/total - get total score for a user across all gameweeks
router.get(
  "/user/:userId/total",
  verifySharedLeagueMembership,
  scoreController.getUserTotalScore,
);

export default router;
