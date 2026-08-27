import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { getGameweekWager } from "./wagers.service.js";

export async function showGameweekWager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getGameweekWager(req.user!.uid, String(req.params.gameweekId)) }); }
  catch (error) { next(error); }
}
