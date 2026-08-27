import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { listMyGameweekPredictions, saveMyGameweekSubmission } from "./predictions.controller.js";

export const predictionsRouter = Router();
predictionsRouter.get("/gameweeks/:gameweekId/predictions/me", authenticate, listMyGameweekPredictions);
predictionsRouter.put("/gameweeks/:gameweekId/submission", authenticate, saveMyGameweekSubmission);
