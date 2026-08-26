import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { removeMyGameweekWager, saveMyGameweekWager, showGameweekWager } from "./wagers.controller.js";

export const wagersRouter = Router();
wagersRouter.get("/gameweeks/:gameweekId/wager/me", authenticate, showGameweekWager);
wagersRouter.put("/gameweeks/:gameweekId/wager", authenticate, saveMyGameweekWager);
wagersRouter.delete("/gameweeks/:gameweekId/wager", authenticate, removeMyGameweekWager);
