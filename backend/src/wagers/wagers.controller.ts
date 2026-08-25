import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { deleteWager, getMyGameweekWagers, getVisibleFixtureWagers, getWallet, upsertWager, wagerInputSchema } from "./wagers.service.js";

export async function showWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getWallet(req.user!.uid) }); } catch (error) { next(error); }
}
export async function showMyGameweekWagers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getMyGameweekWagers(req.user!.uid, String(req.params.gameweekId)) }); } catch (error) { next(error); }
}
export async function saveFixtureWager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await upsertWager(req.user!.uid, String(req.params.fixtureId), wagerInputSchema.parse(req.body)) }); } catch (error) { next(error); }
}
export async function removeFixtureWager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { await deleteWager(req.user!.uid, String(req.params.fixtureId)); res.status(204).send(); } catch (error) { next(error); }
}
export async function showFixtureWagers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getVisibleFixtureWagers(req.user!.uid, String(req.params.fixtureId)) }); } catch (error) { next(error); }
}
