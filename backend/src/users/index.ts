import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/authenticate.js";
import { getCurrentUser, registerProfile } from "./users.controller.js";

export const usersRouter = Router();

// Profile completion performs multiple Firebase operations. Limit this route
// independently so normal profile reads are not unnecessarily throttled.
const registrationRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

usersRouter.post(
  "/register-profile",
  registrationRateLimit,
  authenticate,
  registerProfile,
);
usersRouter.get("/me", authenticate, getCurrentUser);
