import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { teams } from "./data/teams.js";
import { authRouter } from "./routes/auth.js";

export const app = express();
app.use((req, res, next) => { res.locals.requestId = req.header("x-request-id") || crypto.randomUUID(); res.setHeader("x-request-id", res.locals.requestId); next(); });
app.use(helmet());
app.use(cors({ origin: [env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"], credentials: false }));
app.use(express.json({ limit: "32kb" }));
app.use("/api/v1/auth/register-profile", rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", (_req, res) => res.json({ status: "ready" }));
app.get("/api/v1/teams", (_req, res) => res.json({ data: teams }));
app.use("/api/v1/auth", authRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const known = error as { code?: string; status?: number; message?: string };
  const validation = error instanceof ZodError;
  const isKnown = Boolean(known.status && known.code);
  res.status(validation ? 400 : known.status ?? 500).json({ error: { code: validation ? "VALIDATION_ERROR" : known.code ?? "INTERNAL_ERROR", message: validation ? "Check the highlighted information and try again." : isKnown ? known.message : "Something went wrong.", details: validation ? error.flatten() : null, requestId: res.locals.requestId } });
});
