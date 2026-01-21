import { db } from "../../firestore.js";
import fixtureService from "../fixtures/fixtures.service.js";
import leagueScores2Service from "../leagueScores/leagueScores2.service.js";
import TEAMS from "../constants/teams.js";

// Helper function to generate a unique 6-digit alphanumeric code
const generateUniqueLeagueCode = async () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loops

  while (!isUnique && attempts < maxAttempts) {
    // Generate a 6-digit code
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if code already exists in database
    const existingLeague = await db
      .collection("leagues")
      .where("leagueCode", "==", code)
      .limit(1)
      .get();

    isUnique = existingLeague.empty;
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error(
      "Unable to generate unique league code after maximum attempts"
    );
  }

  return code;
};

const createLeague = async ({
  name,
  description,
  creatorUserId,
  is_private,
}) => {
  const newLeagueRef = db.collection("leagues").doc();
  const leagueCode = await generateUniqueLeagueCode();

  // Get the current active gameweek
  const currentGameweekData = await fixtureService.getCurrentGameweek();
  const currentGameweek = currentGameweekData.gameweek;

  await newLeagueRef.set({
    name,
    description,
    creatorUserId,
    is_private,
    leagueCode,
    createdAt: new Date(),
    createdAtGameweek: currentGameweek,
  });

  // Automatically add creator as a member
  const joiningGameweek = currentGameweek;
  await db
    .collection("users_leagues")
    .doc(`${newLeagueRef.id}_${creatorUserId}`)
    .set({
      userId: creatorUserId,
      league_id: newLeagueRef.id,
      joined_at: new Date(),
      joining_gameweek: joiningGameweek,
    });

  // Initialize league score document for the creator
  try {
    await leagueScores2Service.initializeUserLeagueScore(
      newLeagueRef.id,
      creatorUserId,
      joiningGameweek
    );
    console.log(
      `Initialized league score for creator ${creatorUserId} in new league ${newLeagueRef.id}`
    );
  } catch (scoreError) {
    console.error(`Error initializing league score for creator:`, scoreError);
    // Don't fail league creation if score initialization fails
  }

  return {
    id: newLeagueRef.id,
    name,
    description,
    creatorUserId,
    is_private,
    leagueCode,
  };
};

const getLeagueById = async (leagueId) => {
  const leagueDoc = await db.collection("leagues").doc(leagueId).get();
  if (!leagueDoc.exists) return null;

  // Get member count
  const membersSnapshot = await db
    .collection("users_leagues")
    .where("league_id", "==", leagueId)
    .get();

  const memberCount = membersSnapshot.size;

  return {
    id: leagueDoc.id,
    ...leagueDoc.data(),
    memberCount,
  };
};

const getUserLeagues = async (userId) => {
  try {
    // Get current gameweek for rank calculation
    let currentGameweek = 1;
    try {
      const gameweekData = await fixtureService.getCurrentGameweek();
      currentGameweek = gameweekData?.gameweek || 1;
    } catch (err) {
      console.error("Error getting current gameweek for user leagues:", err);
    }

    // Get all user_league relationships for this user
    const userLeaguesSnapshot = await db
      .collection("users_leagues")
      .where("userId", "==", userId)
      .get();

    if (userLeaguesSnapshot.empty) {
      return [];
    }

    // Get league IDs
    const leagueIds = userLeaguesSnapshot.docs.map(
      (doc) => doc.data().league_id
    );

    // Get actual league data, member counts, and user rank
    const leaguesPromises = leagueIds.map(async (leagueId) => {
      const leagueDoc = await db.collection("leagues").doc(leagueId).get();
      if (!leagueDoc.exists) return null;

      // Get member count for this league
      const membersSnapshot = await db
        .collection("users_leagues")
        .where("league_id", "==", leagueId)
        .get();

      // Calculate user's rank in this league
      let userRank = null;
      const totalMembers = membersSnapshot.size;

      try {
        // Get all league scores for this league
        const scoresSnapshot = await db
          .collection("league_scores")
          .where("leagueId", "==", leagueId)
          .get();

        if (!scoresSnapshot.empty) {
          // Calculate total score for each user up to current gameweek
          const userScores = scoresSnapshot.docs.map((doc) => {
            const data = doc.data();
            const gameweekScores = data.gameweekScores || {};

            // Sum scores from gameweek 1 to current gameweek
            let totalScore = 0;
            for (let gw = 1; gw <= currentGameweek; gw++) {
              const gwKey = `gw${gw}`;
              if (gameweekScores[gwKey]?.points) {
                totalScore += gameweekScores[gwKey].points;
              }
            }

            return {
              oderId: data.oderId,
              totalScore,
            };
          });

          // Sort by total score descending
          userScores.sort((a, b) => b.totalScore - a.totalScore);

          // Find user's rank
          const userIndex = userScores.findIndex((s) => s.oderId === userId);
          if (userIndex !== -1) {
            userRank = userIndex + 1;
          }
        }
      } catch (rankError) {
        console.error(
          `Error calculating rank for league ${leagueId}:`,
          rankError
        );
      }

      return {
        doc: leagueDoc,
        memberCount: totalMembers,
        userRank,
        totalMembers,
      };
    });

    const leagueResults = await Promise.all(leaguesPromises);

    // Combine league data with membership info
    const leagues = leagueResults
      .filter((result) => result !== null)
      .map((result) => {
        const { doc, memberCount, userRank, totalMembers } = result;
        const userLeagueDoc = userLeaguesSnapshot.docs.find(
          (userDoc) => userDoc.data().league_id === doc.id
        );

        return {
          id: doc.id,
          ...doc.data(),
          memberCount,
          userRank,
          totalMembers,
          // Add membership metadata
          joined_at: userLeagueDoc?.data().joined_at,
          joining_gameweek: userLeagueDoc?.data().joining_gameweek,
        };
      });

    return leagues;
  } catch (error) {
    console.error("Error getting user leagues:", error);
    throw error;
  }
};

const joinLeague = async (userId, league_code) => {
  if (!db) throw new Error("Firestore not initialized");

  console.log("Attempting to join league with code:", league_code);
  console.log("User ID:", userId);

  // First, find the league by code
  const leagueQuery = await db
    .collection("leagues")
    .where("leagueCode", "==", league_code)
    .limit(1)
    .get();

  if (leagueQuery.empty) {
    throw new Error("League with this code does not exist");
  }

  // Get the league document
  const leagueDoc = leagueQuery.docs[0];
  const leagueData = leagueDoc.data();

  console.log("Found league:", leagueData.name);

  // Check if user is already a member by checking users_leagues collection
  const existingMembership = await db
    .collection("users_leagues")
    .doc(`${leagueDoc.id}_${userId}`)
    .get();

  if (existingMembership.exists) {
    throw new Error("User is already a member of this league");
  }

  // Create entry inside users_leagues collection
  const joiningGameweekData = await fixtureService.getCurrentGameweek();
  const joiningGameweek = joiningGameweekData.gameweek;
  console.log("joiningGameweek= ", joiningGameweek);

  await db.collection("users_leagues").doc(`${leagueDoc.id}_${userId}`).set({
    userId,
    league_id: leagueDoc.id,
    joined_at: new Date(),
    joining_gameweek: joiningGameweek,
  });

  // Initialize league score document for this user in this league
  try {
    await leagueScores2Service.initializeUserLeagueScore(
      leagueDoc.id,
      userId,
      joiningGameweek
    );
    console.log(
      `Initialized league score for user ${userId} in league ${leagueDoc.id}`
    );
  } catch (scoreError) {
    console.error(`Error initializing league score:`, scoreError);
    // Don't fail the join operation if score initialization fails
  }

  console.log(`User ${userId} successfully joined league ${leagueData.name}`);

  return {
    success: true,
    league: {
      id: leagueDoc.id,
      name: leagueData.name,
      code: league_code,
    },
  };
};

const getAllLeagues = async () => {
  const leaguesSnapshot = await db.collection("leagues").get();
  return leaguesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// Create default public leagues for all Premier League teams
const createDefaultTeamLeagues = async () => {
  const results = {
    created: [],
    existing: [],
    errors: [],
  };

  // Get current gameweek for setting createdAtGameweek
  const currentGameweekData = await fixtureService.getCurrentGameweek();
  const currentGameweek = currentGameweekData.gameweek;

  for (const [teamId, teamData] of Object.entries(TEAMS)) {
    const teamLeagueCode = `TEAM${teamId.padStart(2, "0")}`; // e.g., TEAM01, TEAM02, etc.

    try {
      // Check if team league already exists
      const existingLeague = await db
        .collection("leagues")
        .where("leagueCode", "==", teamLeagueCode)
        .limit(1)
        .get();

      if (!existingLeague.empty) {
        results.existing.push({
          teamId,
          teamName: teamData.displayName,
          leagueCode: teamLeagueCode,
        });
        continue;
      }

      // Create new team league
      const newLeagueRef = db.collection("leagues").doc();
      const leagueData = {
        name: `${teamData.displayName} Fans League`,
        description: `Official public league for ${teamData.displayName} supporters`,
        leagueCode: teamLeagueCode,
        creatorUserId: "SYSTEM", // System-created league
        is_private: false,
        teamId: parseInt(teamId), // Store which team this league is for
        leagueType: "team", // Differentiate from user-created leagues
        createdAtGameweek: currentGameweek,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await newLeagueRef.set(leagueData);

      results.created.push({
        id: newLeagueRef.id,
        teamId,
        teamName: teamData.displayName,
        leagueCode: teamLeagueCode,
      });
    } catch (error) {
      results.errors.push({
        teamId,
        teamName: teamData.displayName,
        error: error.message,
      });
    }
  }

  return results;
};

// Create or get a gameweek league (e.g., "GW1 Joiners League")
const createOrGetGameweekLeague = async (gameweek) => {
  const gameweekLeagueCode = `GW${String(gameweek).padStart(2, "0")}`; // e.g., GW01, GW02, etc.

  // Check if gameweek league already exists
  const existingLeague = await db
    .collection("leagues")
    .where("leagueCode", "==", gameweekLeagueCode)
    .limit(1)
    .get();

  if (!existingLeague.empty) {
    const leagueDoc = existingLeague.docs[0];
    return {
      id: leagueDoc.id,
      ...leagueDoc.data(),
      alreadyExists: true,
    };
  }

  // Create new gameweek league
  const newLeagueRef = db.collection("leagues").doc();
  const leagueData = {
    name: `Gameweek ${gameweek}`,
    description: `Public league for users who joined during Gameweek ${gameweek}`,
    leagueCode: gameweekLeagueCode,
    creatorUserId: "SYSTEM",
    is_private: false,
    gameweek: gameweek, // Store which gameweek this league is for
    leagueType: "gameweek", // Differentiate from user-created leagues
    createdAtGameweek: gameweek,
    created_at: new Date(),
    updated_at: new Date(),
    type: "general",
  };

  await newLeagueRef.set(leagueData);

  return {
    id: newLeagueRef.id,
    ...leagueData,
    alreadyExists: false,
  };
};

// Get team league by team ID
const getTeamLeague = async (teamId) => {
  const teamLeagueCode = `TEAM${String(teamId).padStart(2, "0")}`;

  const leagueSnapshot = await db
    .collection("leagues")
    .where("leagueCode", "==", teamLeagueCode)
    .limit(1)
    .get();

  if (leagueSnapshot.empty) {
    return null;
  }

  const leagueDoc = leagueSnapshot.docs[0];
  return {
    id: leagueDoc.id,
    ...leagueDoc.data(),
  };
};

// Export as a single service object
export const leaguesService = {
  createLeague,
  getLeagueById,
  getUserLeagues,
  getAllLeagues,
  joinLeague,
  generateUniqueLeagueCode,
  createDefaultTeamLeagues,
  createOrGetGameweekLeague,
  getTeamLeague,
};
