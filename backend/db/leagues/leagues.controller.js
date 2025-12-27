import leaguesService from "../leagues/leagues.service.js";
import { db } from "../../firestore.js";

const createLeague = async (req, res) => {
  const { name, description, creatorUserId, is_private } = req.body;

  try {
    const newLeague = await leaguesService.createLeague({
      name,
      description,
      creatorUserId,
      is_private,
    });
    return res.status(200).json(newLeague);
  } catch (error) {
    console.error("Error creating league:", error);
    return res.status(500).json({ error: "Failed to create league" });
  }
};

const getLeagueById = async (req, res) => {
  const leagueId = req.params.id;
  try {
    const league = await leaguesService.getLeagueById(leagueId);
    if (!league) return res.status(404).json({ error: "League not found" });
    return res.status(200).json(league);
  } catch (error) {
    console.error("Error fetching league:", error);
    return res.status(500).json({ error: "Failed to fetch league" });
  }
};

const getUserLeagues = async (req, res) => {
  const userId = req.body.userId;
  try {
    const leagues = await leaguesService.getUserLeagues(userId);
    return res.status(200).json(leagues);
  } catch (error) {
    console.error("Error fetching user leagues:", error);
    return res.status(500).json({ error: "Failed to fetch user leagues" });
  }
};

const joinLeague = async (req, res) => {
  const { userId, league_code } = req.body;

  if (!userId || !league_code) {
    return res
      .status(400)
      .json({ error: "userId and league_code are required" });
  }

  try {
    const joinLeagueResult = await leaguesService.joinLeague(
      userId,
      league_code
    );
    return res.status(200).json({
      message: "Joined league successfully",
      ...joinLeagueResult,
    });
  } catch (error) {
    console.error("Error joining league:", error);

    // Handle specific error cases
    if (error.message.includes("does not exist")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("already a member")) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to join league" });
  }
};

const getAllLeagues = async (req, res) => {
  try {
    const result = await leaguesService.getAllLeagues();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching all leagues:", error);
    return res.status(500).json({ error: "Failed to fetch all leagues" });
  }
};

export default {
  createLeague,
  getLeagueById,
  getUserLeagues,
  joinLeague,
  getAllLeagues,
};
