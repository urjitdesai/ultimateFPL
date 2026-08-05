import express from "express";
import fixturesController from "./fixtures.controller.js";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/admin.js";
const router = express.Router();

const adminOnly = [authenticateToken, requireAdmin];

// GET /api/fixtures - list fixtures
router.get("/", fixturesController.listFixtures);

// DELETE /api/fixtures - Delete all fixtures from db
router.delete("/", ...adminOnly, fixturesController.deleteAllFixtures);

// POST /api/fixtures/populate - fetch all fixtures from remote BACKEND_API and write to Firestore
router.post("/populate", ...adminOnly, fixturesController.populateFixtures);

// POST /api/fixtures/populate/:gameweek - fetch fixtures for a specific gameweek
router.post(
  "/populate/:gameweek",
  ...adminOnly,
  fixturesController.populateFixturesForGameweek
);

// POST /api/fixtures/populate-range - fetch fixtures for a range of gameweeks
router.post("/populate-range", ...adminOnly, fixturesController.populateFixturesForRange);

// GET /api/fixtures/gameweek/current - get current gameweek
router.get("/gameweek/current", fixturesController.getCurrentGameweek);

// GET /api/fixtures/:id - get fixture by gameweek ID
router.get("/:id", fixturesController.getFixtureById);

export default router;
