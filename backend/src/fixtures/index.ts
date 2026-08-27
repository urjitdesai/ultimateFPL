import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { providerBackedReadRateLimit } from "../middleware/rate-limits.js";
import { listGameweekFixtures } from "./fixtures.controller.js";

export const fixturesRouter = Router();
fixturesRouter.get("/gameweek/:gameweekId", authenticate, providerBackedReadRateLimit, listGameweekFixtures);
