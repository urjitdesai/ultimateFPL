import express from "express";
import { userController } from "./users.controller.js";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/admin.js";
import { rateLimit } from "express-rate-limit";

const router = express.Router();
const authenticationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Define routes
router.post("/login", authenticationRateLimit, userController.loginUser);
router.post("/logout", userController.logoutUser);
router.post("/populate", authenticateToken, requireAdmin, userController.populateUsers);
router.post("/signup", authenticationRateLimit, userController.createUser);
router.get("/me", authenticateToken, userController.getCurrentUser);
router.get("/all", authenticateToken, requireAdmin, userController.getAllUsers);
router.delete("/delete/email", authenticateToken, requireAdmin, userController.deleteUserWithEmail);
router.delete("/", authenticateToken, requireAdmin, userController.deleteAllUsers);
export default router;
