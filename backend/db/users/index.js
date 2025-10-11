import express from "express";
import {
  loginUser,
  deleteAllUsers,
  populateUsers,
  createUser,
} from "./users.controller.js";

const router = express.Router();

// Define routes
router.post("/login", loginUser);
router.delete("/", deleteAllUsers);
router.post("/populate", populateUsers);
router.post("/signup", createUser);

export default router;
