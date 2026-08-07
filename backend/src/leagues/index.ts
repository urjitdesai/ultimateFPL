import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { listUserLeagues } from "./leagues.controller.js";

export const leaguesRouter = Router();
leaguesRouter.get("/", authenticate, listUserLeagues);
