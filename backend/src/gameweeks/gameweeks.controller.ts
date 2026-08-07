import type { NextFunction, Request, Response } from "express";
import { getCurrentGameweek, getGameweeks } from "./gameweeks.service.js";

export async function listGameweeks(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await getGameweeks() }); } catch (error) { next(error); }
}

export async function currentGameweek(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await getCurrentGameweek() }); } catch (error) { next(error); }
}
