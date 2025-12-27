import express from "express";
import {
  loginUser,
  deleteAllUsers,
  populateUsers,
  createUser,
  getAllUsers,
} from "./users.controller.js";

const router = express.Router();

// Define routes
router.post("/login", loginUser);
router.delete("/", deleteAllUsers);
router.post("/populate", populateUsers);
router.post("/signup", createUser);
router.get("/all", getAllUsers);

export default router;
