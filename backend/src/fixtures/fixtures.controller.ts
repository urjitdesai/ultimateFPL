import type { NextFunction, Request, Response } from "express";
import { getFixturesForGameweek } from "./fixtures.service.js";

export async function listGameweekFixtures(req: Request, res: Response, next: NextFunction) {
  try {
    const fixtures = await getFixturesForGameweek(String(req.params.gameweekId));
    res.json({ data: fixtures });
  } catch (error) { next(error); }
}
