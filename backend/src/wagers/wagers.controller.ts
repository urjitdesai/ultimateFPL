import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { cancelWager, createWager, createWagerSchema, getWagerBoard, matchWager } from "./wagers.service.js";

export async function showWagerBoard(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { res.json({ data: await getWagerBoard(req.user!.uid, String(req.params.leagueId)) }); } catch (error) { next(error); } }
export async function createLeagueWager(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const input = createWagerSchema.parse(req.body); res.status(201).json({ data: await createWager(req.user!.uid, String(req.params.leagueId), input.fixtureId, input.stake) }); } catch (error) { next(error); } }
export async function matchLeagueWager(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { await matchWager(req.user!.uid, String(req.params.leagueId), String(req.params.wagerId)); res.json({ data: { matched: true } }); } catch (error) { next(error); } }
export async function cancelLeagueWager(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { await cancelWager(req.user!.uid, String(req.params.leagueId), String(req.params.wagerId)); res.json({ data: { cancelled: true } }); } catch (error) { next(error); } }
