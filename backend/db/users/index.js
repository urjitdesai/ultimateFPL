import express from "express";
import { userController } from "./users.controller.js";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/admin.js";

const router = express.Router();

// Define routes
router.post("/login", userController.loginUser);
router.post("/logout", userController.logoutUser);
router.post("/populate", authenticateToken, requireAdmin, userController.populateUsers);
router.post("/signup", userController.createUser);
router.get("/all", authenticateToken, requireAdmin, userController.getAllUsers);
router.delete("/delete/email", authenticateToken, requireAdmin, userController.deleteUserWithEmail);
router.delete("/", authenticateToken, requireAdmin, userController.deleteAllUsers);
export default router;
