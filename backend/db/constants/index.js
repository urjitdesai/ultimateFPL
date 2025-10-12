import express from "express";
import teams from "./teams.js";

const router = express.Router();

// GET /api/constants/teams - Get all teams
router.get("/teams", (req, res) => {
  try {
    res.json({
      success: true,
      data: teams,
      total: Object.keys(teams).length,
    });
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch teams",
    });
  }
});

// GET /api/constants/teams/:id - Get team by ID
router.get("/teams/:id", (req, res) => {
  try {
    const teamId = req.params.id;
    const team = teams[teamId];

    if (!team) {
      return res.status(404).json({
        success: false,
        error: `Team with ID ${teamId} not found`,
      });
    }

    res.json({
      success: true,
      data: {
        id: teamId,
        ...team,
      },
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch team",
    });
  }
});

export default router;
