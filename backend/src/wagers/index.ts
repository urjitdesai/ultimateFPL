import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { removeFixtureWager, saveFixtureWager, showFixtureWagers, showMyGameweekWagers, showWallet } from "./wagers.controller.js";

export const wagersRouter = Router();
wagersRouter.get("/wallet", authenticate, showWallet);
wagersRouter.get("/gameweeks/:gameweekId/wagers/me", authenticate, showMyGameweekWagers);
wagersRouter.put("/fixtures/:fixtureId/wager", authenticate, saveFixtureWager);
wagersRouter.delete("/fixtures/:fixtureId/wager", authenticate, removeFixtureWager);
wagersRouter.get("/fixtures/:fixtureId/wagers", authenticate, showFixtureWagers);
