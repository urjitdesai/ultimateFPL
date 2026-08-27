import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { showGameweekWager } from "./wagers.controller.js";

export const wagersRouter = Router();
wagersRouter.get("/gameweeks/:gameweekId/wager/me", authenticate, showGameweekWager);
