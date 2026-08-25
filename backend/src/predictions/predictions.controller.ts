import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { getGameweekPredictions, predictionBatchSchema, saveGameweekPredictions } from "./predictions.service.js";

export async function listMyGameweekPredictions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ data: await getGameweekPredictions(req.user!.uid, String(req.params.gameweekId)) });
  } catch (error) { next(error); }
}

export async function saveMyGameweekPredictions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = predictionBatchSchema.parse(req.body);
    res.json({ data: await saveGameweekPredictions(req.user!.uid, String(req.params.gameweekId), input) });
  } catch (error) { next(error); }
}
