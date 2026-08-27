import { Router } from "express";
import { providerBackedReadRateLimit } from "../middleware/rate-limits.js";
import { listTeams } from "./teams.controller.js";

export const teamsRouter = Router();
teamsRouter.get("/", providerBackedReadRateLimit, listTeams);
