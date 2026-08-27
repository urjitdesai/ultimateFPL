import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { profileWriteRateLimit } from "../middleware/rate-limits.js";
import { getCurrentUser, registerProfile } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.post(
  "/register-profile",
  authenticate,
  profileWriteRateLimit,
  registerProfile,
);
usersRouter.get("/me", authenticate, getCurrentUser);
