import { db } from "../../firestore.js";
import fixtureService from "../fixtures/fixtures.service.js";

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

  await newLeagueRef.set({
    name,
    description,
    creatorUserId,
    is_private,
    leagueCode,
    createdAt: new Date(),
  });

  // Automatically add creator as a member
  const joiningGameweek = await fixtureService.getCurrentGameweek();
  await db
    .collection("users_leagues")
    .doc(`${newLeagueRef.id}_${creatorUserId}`)
    .set({
      userId: creatorUserId,
      league_id: newLeagueRef.id,
      joined_at: new Date(),
      joining_gameweek: joiningGameweek,
    });

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

    // Get actual league data and member counts
    const leaguesPromises = leagueIds.map(async (leagueId) => {
      const leagueDoc = await db.collection("leagues").doc(leagueId).get();
      if (!leagueDoc.exists) return null;

      // Get member count for this league
      const membersSnapshot = await db
        .collection("users_leagues")
        .where("league_id", "==", leagueId)
        .get();

      return {
        doc: leagueDoc,
        memberCount: membersSnapshot.size,
      };
    });

    const leagueResults = await Promise.all(leaguesPromises);

    // Combine league data with membership info
    const leagues = leagueResults
      .filter((result) => result !== null)
      .map((result) => {
        const { doc, memberCount } = result;
        const userLeagueDoc = userLeaguesSnapshot.docs.find(
          (userDoc) => userDoc.data().league_id === doc.id
        );

        return {
          id: doc.id,
          ...doc.data(),
          memberCount,
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
  const joiningGameweek = await fixtureService.getCurrentGameweek();
  console.log("joiningGameweek= ", joiningGameweek);

  await db.collection("users_leagues").doc(`${leagueDoc.id}_${userId}`).set({
    userId,
    league_id: leagueDoc.id,
    joined_at: new Date(),
    joining_gameweek: joiningGameweek,
  });

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

// Export as a single service object
export const leaguesService = {
  createLeague,
  getLeagueById,
  getUserLeagues,
  getAllLeagues,
  joinLeague,
  generateUniqueLeagueCode,
};
