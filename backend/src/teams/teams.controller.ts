import type { NextFunction, Request, Response } from "express";
import { getTeams } from "./teams.service.js";

export async function listTeams(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await getTeams() }); } catch (error) { next(error); }
}
