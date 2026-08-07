import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { teamsRouter } from "./teams/index.js";
import { usersRouter } from "./users/index.js";

export const app = express();

// Attach a request ID early so every response and error can be correlated with
// server logs. Preserve a caller-provided ID when one is available.
app.use((req, res, next) => {
  res.locals.requestId =
    req.header("x-request-id") || crypto.randomUUID();

  res.setHeader("x-request-id", res.locals.requestId);
  next();
});

// Global security and request-parsing middleware.
app.use(helmet());
app.use(
  cors({
    origin: [
      env.FRONTEND_URL,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    credentials: false,
  }),
);
app.use(express.json({ limit: "32kb" }));

// Infrastructure probes used by local tooling and deployment platforms.
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", (_req, res) => res.json({ status: "ready" }));

// Feature routes. Each backend noun owns its routes, controller, and service.
app.use("/api/v1/teams", teamsRouter);
app.use("/api/v1/auth", usersRouter);

// Keep this handler last so errors from every route use the same public shape.
// Unexpected server errors receive a generic message to avoid leaking details.
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const knownError = error as {
      code?: string;
      status?: number;
      message?: string;
    };

    const isValidationError = error instanceof ZodError;
    const isKnownError = Boolean(knownError.status && knownError.code);
    const status = isValidationError ? 400 : (knownError.status ?? 500);

    res.status(status).json({
      error: {
        code: isValidationError
          ? "VALIDATION_ERROR"
          : (knownError.code ?? "INTERNAL_ERROR"),
        message: isValidationError
          ? "Check the highlighted information and try again."
          : isKnownError
            ? knownError.message
            : "Something went wrong.",
        details: isValidationError ? error.flatten() : null,
        requestId: res.locals.requestId,
      },
    });
  },
);
