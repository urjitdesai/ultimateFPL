import express from "express";
import { leaguesController } from "./leagues.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = express.Router();

// Protected routes that require authentication
router.post("/create", authenticateToken, leaguesController.createLeague);
router.post(
  "/user-leagues",
  authenticateToken,
  leaguesController.getUserLeagues
);
router.post("/join", authenticateToken, leaguesController.joinLeague);

// Public routes
router.get("/:id", leaguesController.getLeagueById);
router.get("/", leaguesController.getAllLeagues);

export default router;
