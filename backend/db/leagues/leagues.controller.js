import { leaguesService } from "../leagues/leagues.service.js";

export const createLeague = async (req, res) => {
  // creatorUserId is now available from JWT token
  const creatorUserId = req.user.id;
  const { name, description, is_private } = req.body;

  if (!name) {
    return res.status(400).json({ error: "League name is required" });
  }

  try {
    const newLeague = await leaguesService.createLeague({
      name,
      description,
      creatorUserId,
      is_private: is_private || false,
    });
    return res.status(201).json({
      success: true,
      message: "League created successfully",
      league: newLeague,
    });
  } catch (error) {
    console.error("Error creating league:", error);
    return res.status(500).json({ error: "Failed to create league" });
  }
};

export const getLeagueById = async (req, res) => {
  const leagueId = req.params.id;
  try {
    const league = await leaguesService.getLeagueById(leagueId);
    if (!league) return res.status(404).json({ error: "League not found" });
    return res.status(200).json({
      success: true,
      league: league,
    });
  } catch (error) {
    console.error("Error fetching league:", error);
    return res.status(500).json({ error: "Failed to fetch league" });
  }
};

export const getUserLeagues = async (req, res) => {
  // userId is now available from JWT token via requireUserId middleware
  const userId = req.user.id;
  try {
    const leagues = await leaguesService.getUserLeagues(userId);
    return res.status(200).json({
      success: true,
      leagues: leagues,
    });
  } catch (error) {
    console.error("Error fetching user leagues:", error);
    return res.status(500).json({ error: "Failed to fetch user leagues" });
  }
};

export const joinLeague = async (req, res) => {
  // userId is now available from JWT token via requireUserId middleware
  const userId = req.user.id;
  const { league_code } = req.body;

  if (!league_code) {
    return res.status(400).json({ error: "league_code is required" });
  }

  try {
    const joinLeagueResult = await leaguesService.joinLeague(
      userId,
      league_code
    );
    return res.status(200).json({
      success: true,
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

export const getAllLeagues = async (req, res) => {
  try {
    const result = await leaguesService.getAllLeagues();
    return res.status(200).json({
      success: true,
      leagues: result,
    });
  } catch (error) {
    console.error("Error fetching all leagues:", error);
    return res.status(500).json({ error: "Failed to fetch all leagues" });
  }
};

// Export as a single controller object
export const leaguesController = {
  createLeague,
  getLeagueById,
  getUserLeagues,
  joinLeague,
  getAllLeagues,
};
