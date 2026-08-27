import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";
import type { AuthenticatedRequest } from "./authenticate.js";
import { FirestoreRateLimitStore } from "./firestore-rate-limit.store.js";

export type RateLimitOptions = {
  code: string;
  limit: number;
  message: string;
};

function requestKey(request: Request) {
  const userId = (request as AuthenticatedRequest).user?.uid;
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(request.ip ?? "")}`;
}

export function createRateLimit({ code, limit, message }: RateLimitOptions) {
  const storePrefix = code.toLowerCase();
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: requestKey,
    ...(env.NODE_ENV === "production"
      ? { store: new FirestoreRateLimitStore(storePrefix, env.RATE_LIMIT_WINDOW_MS) }
      : {}),
    handler: (_request, response) => response.status(429).json({
      error: {
        code,
        message,
        details: null,
        requestId: response.locals.requestId,
      },
    }),
  });
}

export const profileWriteRateLimit = createRateLimit({
  code: "PROFILE_RATE_LIMITED",
  limit: env.PROFILE_RATE_LIMIT,
  message: "Too many profile requests. Wait a moment and try again.",
});

export const leagueCreateRateLimit = createRateLimit({
  code: "LEAGUE_CREATE_RATE_LIMITED",
  limit: env.LEAGUE_CREATE_RATE_LIMIT,
  message: "Too many league creation attempts. Wait a moment and try again.",
});

export const leagueJoinRateLimit = createRateLimit({
  code: "LEAGUE_JOIN_RATE_LIMITED",
  limit: env.LEAGUE_JOIN_RATE_LIMIT,
  message: "Too many league-key attempts. Wait a moment and try again.",
});

export const gameweekSubmissionRateLimit = createRateLimit({
  code: "GAMEWEEK_SUBMISSION_RATE_LIMITED",
  limit: env.GAMEWEEK_SUBMISSION_RATE_LIMIT,
  message: "Too many gameweek submissions. Wait a moment and try again.",
});

export const standingsReadRateLimit = createRateLimit({
  code: "STANDINGS_RATE_LIMITED",
  limit: env.STANDINGS_READ_RATE_LIMIT,
  message: "Too many standings requests. Wait a moment and try again.",
});

export const providerBackedReadRateLimit = createRateLimit({
  code: "DATA_READ_RATE_LIMITED",
  limit: env.PROVIDER_BACKED_READ_RATE_LIMIT,
  message: "Too many fixture-data requests. Wait a moment and try again.",
});
