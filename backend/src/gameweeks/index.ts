import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { providerBackedReadRateLimit } from "../middleware/rate-limits.js";
import { currentGameweek, listGameweeks } from "./gameweeks.controller.js";

export const gameweeksRouter = Router();
gameweeksRouter.get("/", authenticate, providerBackedReadRateLimit, listGameweeks);
gameweeksRouter.get("/current", authenticate, providerBackedReadRateLimit, currentGameweek);
