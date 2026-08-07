import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { getUserLeagues } from "./leagues.service.js";

export async function listUserLeagues(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try { res.json({ data: await getUserLeagues(req.user!.uid) }); } catch (error) { next(error); }
}
