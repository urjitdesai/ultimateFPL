import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { getLeagueStandings, getUserLeagues } from "./leagues.service.js";

export async function listUserLeagues(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getUserLeagues(req.user!.uid) }); } catch (error) { next(error); }
}

export async function showLeagueStandings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getLeagueStandings(req.user!.uid, String(req.params.leagueId)) }); }
  catch (error) { next(error); }
}
