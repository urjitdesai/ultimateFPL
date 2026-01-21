import express from "express";
import { simulateController } from "./simulate.controller.js";
// import { authenticateToken } from "../../middleware/auth.js";

const router = express.Router();

// Admin routes for simulation
// Note: In production, add proper admin authentication middleware
// router.post("/simulate", authenticateToken, isAdmin, simulateController.simulateGameweek);

router.post("/gameweek", simulateController.simulateGameweek);
router.post("/gameweek-range", simulateController.simulateGameweekRange);

export default router;
