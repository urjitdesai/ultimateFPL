import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_DATABASE_ID: z.string().default("(default)"),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  ACTIVE_SEASON_ID: z.string().optional(),
  BACKEND_API: z.string().url(),
  BACKEND_API_TOKEN: z.string().min(1),
  FOOTBALLDATA_IO_LEAGUE_ID: z.coerce.number().int().positive(),
  FOOTBALLDATA_IO_SEASON_YEAR: z.coerce.number().int().positive()
});

export const env = schema.parse(process.env);
