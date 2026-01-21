import fixtureService from "./fixtures.service.js";

// GET /api/fixtures
const listFixtures = async (req, res) => {
  console.log("in listFixtures controller");
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

// GET /api/fixtures/gameweek/current
const getCurrentGameweek = async (req, res) => {
  console.log("in getCurrentGameweek controller");
  try {
    const result = await fixtureService.getCurrentGameweek();
    res.json({
      currentGameweek: result.gameweek,
      deadline: result.deadline,
    });
  } catch (err) {
    console.error("Error getting current gameweek:", err);
    res.status(500).json({ error: "Failed to get current gameweek" });
  }
};

// POST /api/fixtures/populate/:gameweek - Populate fixtures for a specific gameweek
const populateFixturesForGameweek = async (req, res) => {
  try {
    const gameweek = parseInt(req.params.gameweek, 10);

    if (!gameweek || gameweek < 1 || gameweek > 38) {
      return res
        .status(400)
        .json({ error: "Valid gameweek (1-38) is required" });
    }

    console.log(`[FIXTURES] Populating fixtures for gameweek ${gameweek}`);
    const result = await fixtureService.populateFixturesForGameweek(gameweek);

    res.json({
      success: true,
      message: `Fixtures populated for gameweek ${gameweek}`,
      ...result,
    });
  } catch (err) {
    console.error("Error populating fixtures for gameweek:", err);
    res
      .status(500)
      .json({
        error: err.message || "Failed to populate fixtures for gameweek",
      });
  }
};

// POST /api/fixtures/populate-range - Populate fixtures for a range of gameweeks
const populateFixturesForRange = async (req, res) => {
  try {
    const { startGameweek, endGameweek } = req.body;

    if (
      !startGameweek ||
      !endGameweek ||
      startGameweek < 1 ||
      endGameweek > 38 ||
      startGameweek > endGameweek
    ) {
      return res.status(400).json({
        error:
          "Valid startGameweek and endGameweek (1-38, start <= end) are required",
      });
    }

    console.log(
      `[FIXTURES] Populating fixtures for gameweeks ${startGameweek} to ${endGameweek}`
    );
    const result = await fixtureService.populateFixturesForRange(
      parseInt(startGameweek, 10),
      parseInt(endGameweek, 10)
    );

    res.json({
      success: true,
      message: `Fixtures populated for gameweeks ${startGameweek}-${endGameweek}`,
      ...result,
    });
  } catch (err) {
    console.error("Error populating fixtures for range:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to populate fixtures for range" });
  }
};

export default {
  listFixtures,
  deleteAllFixtures,
  populateFixtures,
  populateFixturesForGameweek,
  populateFixturesForRange,
  getFixtureById,
  getCurrentGameweek,
};
