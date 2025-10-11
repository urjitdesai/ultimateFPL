import express from "express";
import userPredController from "./userPrediction.controller.js";
const router = express.Router();

// DELETE /api/user-predictions
router.delete("/", userPredController.deleteAll);

// GET /api/user-predictions/:id
router.post("/get-predictions", userPredController.getUserPredictionsById);

// POST /api/user-predictions/populate-predictions
router.post("/populate-predictions", userPredController.populate);

// POST /api/user-predictions/calculate-scores
router.post("/calculate-scores", userPredController.calculate);

export default router;
