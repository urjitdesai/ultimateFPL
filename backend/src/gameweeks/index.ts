import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { currentGameweek, listGameweeks } from "./gameweeks.controller.js";

export const gameweeksRouter = Router();
gameweeksRouter.get("/", authenticate, listGameweeks);
gameweeksRouter.get("/current", authenticate, currentGameweek);
