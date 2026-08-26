import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { deleteGameweekWager, getGameweekWager, saveGameweekWager, wagerInputSchema } from "./wagers.service.js";

export async function showGameweekWager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getGameweekWager(req.user!.uid, String(req.params.gameweekId)) }); }
  catch (error) { next(error); }
}

export async function saveMyGameweekWager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ data: await saveGameweekWager(req.user!.uid, String(req.params.gameweekId), wagerInputSchema.parse(req.body)) });
  } catch (error) { next(error); }
}

export async function removeMyGameweekWager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await deleteGameweekWager(req.user!.uid, String(req.params.gameweekId));
    res.json({ data: await getGameweekWager(req.user!.uid, String(req.params.gameweekId)) });
  } catch (error) { next(error); }
}
