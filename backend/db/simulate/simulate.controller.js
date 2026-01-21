import { simulateService } from "./simulate.service.js";

/**
 * Simulate a single gameweek
 * POST /admin/simulate
 * Body: { gameweek: number }
 */
const simulateGameweek = async (req, res) => {
  try {
    const { gameweek } = req.body;

    if (!gameweek || gameweek < 1 || gameweek > 38) {
      return res.status(400).json({
        success: false,
        message: "Valid gameweek (1-38) is required",
      });
    }

    const gameweekNum = parseInt(gameweek, 10);
    console.log(`[ADMIN] Simulating gameweek ${gameweekNum}...`);

    const result = await simulateService.simulateGameweek(gameweekNum);

    res.json({
      success: true,
      message: `Simulation complete for gameweek ${gameweekNum}`,
      data: result,
    });
  } catch (error) {
    console.error("Error simulating gameweek:", error);
    res.status(500).json({
      success: false,
      message: "Failed to simulate gameweek",
      error: error.message,
    });
  }
};

/**
 * Simulate a range of gameweeks
 * POST /admin/simulate-range
 * Body: { startGameweek: number, endGameweek: number }
 */
const simulateGameweekRange = async (req, res) => {
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
        success: false,
        message:
          "Valid startGameweek and endGameweek (1-38, start <= end) are required",
      });
    }

    const startNum = parseInt(startGameweek, 10);
    const endNum = parseInt(endGameweek, 10);

    console.log(`[ADMIN] Simulating gameweeks ${startNum} to ${endNum}...`);

    const result = await simulateService.simulateGameweekRange(startNum, endNum);

    res.json({
      success: true,
      message: `Simulation complete for gameweeks ${startNum}-${endNum}`,
      data: result,
    });
  } catch (error) {
    console.error("Error simulating gameweek range:", error);
    res.status(500).json({
      success: false,
      message: "Failed to simulate gameweek range",
      error: error.message,
    });
  }
};

export const simulateController = {
  simulateGameweek,
  simulateGameweekRange,
};

export default simulateController;
