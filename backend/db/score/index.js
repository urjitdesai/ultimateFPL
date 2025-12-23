import express from "express";
import scoreController from "./score.controller.js";
const router = express.Router();

// GET /api/score/user/:userId/gameweek/:gameweek - get score for a specific user and gameweek
router.get(
  "/user/:userId/gameweek/:gameweek",
  scoreController.getUserGameweekScore
);

// GET /api/score/user/:userId/total - get total score for a user across all gameweeks
router.get("/user/:userId/total", scoreController.getUserTotalScore);

export default router;
