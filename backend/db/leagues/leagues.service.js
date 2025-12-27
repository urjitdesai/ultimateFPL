import { log } from "console";
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

  return { id: leagueDoc.id, ...leagueDoc.data() };
};

const getUserLeagues = async (userId) => {
  const leaguesSnapshot = await db
    .collection("leagues")
    .where("creatorUserId", "==", userId)
    .get();

  return leaguesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
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

  // Create entry inside users_leagues collection
  const userLeaguesRef = db
    .collection("users_leagues")
    .doc(`${leagueData.id}_${userId}`);
  await userLeaguesRef.set({
    userId,
    league_id: leagueData.id,
    joined_at: new Date(),
    joining_gameweek: fixtureService.getCurrentGameweek(),
  });

  // Check if user is already a member
  const currentMembers = leagueData.members || [];
  if (currentMembers.includes(userId)) {
    throw new Error("User is already a member of this league");
  }

  // Add user to members array
  const updatedMembers = [...currentMembers, userId];

  // Update the league document
  await leagueDoc.ref.update({
    members: updatedMembers,
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

export default {
  createLeague,
  getLeagueById,
  getUserLeagues,
  getAllLeagues,
  joinLeague,
  generateUniqueLeagueCode,
};
