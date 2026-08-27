import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { gameweekSubmissionRateLimit, providerBackedReadRateLimit } from "../middleware/rate-limits.js";
import { listMyGameweekPredictions, saveMyGameweekSubmission } from "./predictions.controller.js";

export const predictionsRouter = Router();
predictionsRouter.get("/gameweeks/:gameweekId/predictions/me", authenticate, providerBackedReadRateLimit, listMyGameweekPredictions);
predictionsRouter.put("/gameweeks/:gameweekId/submission", authenticate, gameweekSubmissionRateLimit, saveMyGameweekSubmission);
