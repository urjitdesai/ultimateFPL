import type { Request, Response } from "express";
import { getTeams } from "./teams.service.js";

export function listTeams(_req: Request, res: Response) {
  res.json({ data: getTeams() });
}
