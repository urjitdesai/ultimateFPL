import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { gameweekSubmissionSchema, saveGameweekSubmission } from "./gameweek-submission.service.js";
import { getGameweekPredictions } from "./predictions.service.js";

export async function listMyGameweekPredictions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ data: await getGameweekPredictions(req.user!.uid, String(req.params.gameweekId)) });
  } catch (error) { next(error); }
}

export async function saveMyGameweekSubmission(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = gameweekSubmissionSchema.parse(req.body);
    res.json({ data: await saveGameweekSubmission(req.user!.uid, String(req.params.gameweekId), input) });
  } catch (error) { next(error); }
}
