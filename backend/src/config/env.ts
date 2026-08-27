import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().transform((value) => new URL(value).origin).default("http://localhost:5173"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  REQUEST_BODY_LIMIT: z.string().regex(/^\d+(?:kb|mb)$/i).default("32kb"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(60_000),
  HEADERS_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(15_000),
  SERVER_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(65_000),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_DATABASE_ID: z.string().default("(default)"),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  ACTIVE_SEASON_ID: z.string().optional(),
  BACKEND_API: z.string().url(),
  BACKEND_API_TOKEN: z.string().min(1),
  FOOTBALLDATA_IO_LEAGUE_ID: z.coerce.number().int().positive(),
  FOOTBALLDATA_IO_SEASON_YEAR: z.coerce.number().int().positive(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
  PROFILE_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  LEAGUE_CREATE_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  LEAGUE_JOIN_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  GAMEWEEK_SUBMISSION_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  STANDINGS_READ_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  PROVIDER_BACKED_READ_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  MAX_CREATED_LEAGUES_PER_USER: z.coerce.number().int().positive().default(50),
  MAX_PRIVATE_LEAGUE_MEMBERS: z.coerce.number().int().min(2).default(100),
}).superRefine((values, context) => {
  if (values.HEADERS_TIMEOUT_MS > values.REQUEST_TIMEOUT_MS) {
    context.addIssue({
      code: "custom",
      path: ["HEADERS_TIMEOUT_MS"],
      message: "HEADERS_TIMEOUT_MS must not exceed REQUEST_TIMEOUT_MS.",
    });
  }
  if (values.SERVER_TIMEOUT_MS < values.REQUEST_TIMEOUT_MS) {
    context.addIssue({
      code: "custom",
      path: ["SERVER_TIMEOUT_MS"],
      message: "SERVER_TIMEOUT_MS must be at least REQUEST_TIMEOUT_MS.",
    });
  }
  if (values.NODE_ENV !== "production") return;
  const frontendHostname = new URL(values.FRONTEND_URL).hostname;
  if (["localhost", "127.0.0.1", "::1"].includes(frontendHostname)) {
    context.addIssue({
      code: "custom",
      path: ["FRONTEND_URL"],
      message: "FRONTEND_URL must be a production origin in production.",
    });
  }
  if (values.TRUST_PROXY_HOPS === 0) {
    context.addIssue({
      code: "custom",
      path: ["TRUST_PROXY_HOPS"],
      message: "TRUST_PROXY_HOPS must be configured in production.",
    });
  }
});

export const env = schema.parse(process.env);
