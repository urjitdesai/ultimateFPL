import express from "express";
import { userController } from "./users.controller.js";

const router = express.Router();

// Define routes
router.post("/login", userController.loginUser);
router.post("/populate", userController.populateUsers);
router.post("/signup", userController.createUser);
router.get("/all", userController.getAllUsers);
router.delete("/delete/email", userController.deleteUserWithEmail);
router.delete("/", userController.deleteAllUsers);
export default router;
