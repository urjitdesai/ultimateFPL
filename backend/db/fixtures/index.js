import express from "express";
import fixturesController from "./fixtures.controller.js";
const router = express.Router();

// GET /api/fixtures - list fixtures
router.get("/", fixturesController.listFixtures);

// DELETE /api/fixtures - Delete all fixtures from db
router.delete("/", fixturesController.deleteAllFixtures);

// POST /api/fixtures/populate - fetch from remote BACKEND_API and write to Firestore
router.post("/populate", fixturesController.populateFixtures);

// GET /api/fixtures/:id - get fixture by gameweek ID
router.get("/:id", fixturesController.getFixtureById);

export default router;
