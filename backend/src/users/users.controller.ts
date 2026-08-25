import type { NextFunction, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { createProfile, getProfile } from "./users.service.js";

const registration = z.object({ displayName: z.string().trim().min(2).max(40) });

export async function registerProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = registration.parse(req.body);
    const profile = await createProfile({ ...input, uid: req.user!.uid, email: req.user!.email });
    res.status(201).json({ data: profile });
  } catch (error) { next(error); }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const profile = await getProfile(req.user!.uid);
    if (!profile) return res.status(404).json({ error: { code: "PROFILE_NOT_FOUND", message: "Complete your profile to continue.", details: null, requestId: res.locals.requestId } });
    res.json({ data: profile });
  } catch (error) { next(error); }
}
