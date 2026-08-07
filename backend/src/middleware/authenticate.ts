import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "../firebase/admin.js";

export type AuthenticatedRequest = Request & { user?: { uid: string; email: string } };

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in to continue.", details: null, requestId: res.locals.requestId } });
  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email ?? "" };
    next();
  } catch {
    return res.status(401).json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Your session is no longer valid. Please sign in again.", details: null, requestId: res.locals.requestId } });
  }
}
