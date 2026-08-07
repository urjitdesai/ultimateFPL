import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { createLeague, createLeagueSchema, getLeagueMemberPredictions, getLeagueStandings, getUserLeagues, joinLeague, joinLeagueSchema } from "./leagues.service.js";

export async function listUserLeagues(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getUserLeagues(req.user!.uid) }); } catch (error) { next(error); }
}

export async function createUserLeague(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = createLeagueSchema.parse(req.body);
    res.status(201).json({ data: await createLeague(req.user!.uid, input.name, input.scoringType) });
  } catch (error) { next(error); }
}

export async function joinUserLeague(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = joinLeagueSchema.parse(req.body);
    res.json({ data: await joinLeague(req.user!.uid, input.inviteCode) });
  } catch (error) { next(error); }
}

export async function showLeagueMemberPredictions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ data: await getLeagueMemberPredictions(
      req.user!.uid,
      String(req.params.leagueId),
      String(req.params.memberUserId),
      typeof req.query.gameweekId === "string" ? req.query.gameweekId : undefined,
    ) });
  } catch (error) { next(error); }
}

export async function showLeagueStandings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getLeagueStandings(req.user!.uid, String(req.params.leagueId)) }); }
  catch (error) { next(error); }
}
