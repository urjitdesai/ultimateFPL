import express from "express";
import userPredController from "./userPrediction.controller.js";
import { authenticateToken } from "../../middleware/auth.js";
const router = express.Router();

// DELETE /api/user-predictions
router.delete("/", authenticateToken, userPredController.deleteAll);

// GET /api/user-predictions/:id
router.post(
  "/get-predictions",
  authenticateToken,
  userPredController.getUserPredictionsById
);

// POST /api/user-predictions/populate-predictions
router.post(
  "/populate-predictions",
  authenticateToken,
  userPredController.populate
);

// POST /api/user-predictions/calculate-scores
router.post(
  "/calculate-scores",
  authenticateToken,
  userPredController.calculate
);

// POST /api/user-predictions/calculate-all-scores
router.post(
  "/calculate-all-scores",
  //   authenticateToken,
  userPredController.calculateAllUsersScores
);

router.post(
  "/",
  authenticateToken,
  userPredController.createOrUpdatePredictions
);

export default router;
