import fixtureService from "./fixtures.service.js";
import { db } from "../../firestore.js";

// GET /api/fixtures
const listFixtures = async (req, res) => {
  console.log("in listFixtures controller");
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const result = await fixtureService.listFixtures();
    res.json({ fixtures: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list fixtures" });
  }
};

// DELETE /api/fixtures
const deleteAllFixtures = async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const result = await fixtureService.deleteAllFixtures();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete fixtures" });
  }
};

// POST /api/fixtures/populate
const populateFixtures = async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const result = await fixtureService.populateFixtures();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to populate fixtures" });
  }
};

// GET /api/fixtures/:id
const getFixtureById = async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const eventId = req.params.id;
    const result = await fixtureService.getFixtureById(eventId);
    res.json({ fixtures: result });
  } catch (err) {
    console.error(err);
    // differentiate not-found vs internal error
    if (err && /not found/i.test(err.message)) {
      return res.status(404).json({ error: "Fixture not found" });
    }
    res.status(500).json({ error: "Failed to get fixtures" });
  }
};

export default {
  listFixtures,
  deleteAllFixtures,
  populateFixtures,
  getFixtureById,
};
