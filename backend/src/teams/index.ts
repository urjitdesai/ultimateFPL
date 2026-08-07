import { Router } from "express";
import { listTeams } from "./teams.controller.js";

export const teamsRouter = Router();
teamsRouter.get("/", listTeams);
