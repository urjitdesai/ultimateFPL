import jwt from "jsonwebtoken";
import { db } from "../../firestore.js";
import axios from "axios";
import admin from "firebase-admin";
import bcrypt from "bcrypt";
import { leaguesService } from "../leagues/leagues.service.js";

const createUserInDb = async (email, password, displayName) => {
  if (!admin) throw new Error("Firebase admin not initialized");

  const passwordHash = await bcrypt.hash(password, 10);
  const doesUserExist = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (doesUserExist && !doesUserExist.empty) {
    throw new Error("User with this email already exists");
  }

  // Create user with hashed password
  const docRef = await db.collection("users").add({
    email: email,
    display_name: displayName || null,
    password: passwordHash,
    created_at: new Date(),
  });

  await leaguesService.joinLeague(docRef.id, "OVERALL"); // auto-join overall league

  // Create user object for JWT
  const userData = {
    id: docRef.id,
    email: email,
    display_name: displayName || null,
  };

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: docRef.id,
      email: email,
      display_name: displayName || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    user: userData,
    token: token,
  };
};

const authenticateUser = async (email, password) => {
  // Fetch user from Firestore
  const userSnap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  // console.log("userSnap=", userSnap);

  if (userSnap.empty) throw new Error("Invalid email or password");

  const userData = userSnap.docs[0].data();
  const userId = userSnap.docs[0].id;

  // Verify password using bcrypt
  const isPasswordValid = await bcrypt.compare(password, userData.password);
  if (!isPasswordValid) {
    throw new Error("Invalid password");
  }

  // Create user object for JWT (exclude password)
  const user = {
    id: userId,
    email: userData.email,
    display_name: userData.display_name,
  };

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: userId,
      email: userData.email,
      display_name: userData.display_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    user: user,
    token: token,
  };
};

const deleteUsersFromDb = async () => {
  const colRef = db.collection("users");
  const snap = await colRef.get();
  if (snap.empty) return 0;

  const docs = snap.docs;
  const chunkSize = 400; // keep below 500 write limit
  let deleted = 0;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + chunkSize);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
};

const fetchAndPopulateUsers = async () => {
  const backendApi = process.env.BACKEND_API;
  if (!backendApi) {
    throw new Error("BACKEND_API environment variable not defined");
  }

  const url = `${backendApi.replace(/\/$/, "")}/users`;

  const resp = await axios.get(url, { timeout: 15000 });
  const users = Array.isArray(resp.data)
    ? resp.data
    : resp.data.users || resp.data;

  if (!Array.isArray(users)) {
    throw new Error("Unexpected users response format");
  }

  // Firestore batch limit is 500; chunk into batches of 400 to be safe
  const chunkSize = 400;
  let totalWritten = 0;

  for (let i = 0; i < users.length; i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach((u) => {
      const docId =
        u && (u.id || u.user_id || u.uid)
          ? String(u.id || u.user_id || u.uid)
          : undefined;
      const docRef = docId
        ? db.collection("users").doc(docId)
        : db.collection("users").doc();
      batch.set(docRef, u, { merge: true });
    });
    await batch.commit();
    totalWritten += chunk.length;
  }

  return totalWritten;
};

const getAllUsersFromDb = async () => {
  const usersSnapshot = await db.collection("users").get();
  return usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

const deleteUserWithEmail = async (email) => {
  const userQuery = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (userQuery.empty) {
    throw new Error("User with this email does not exist");
  }
  const userDoc = userQuery.docs[0];
  await userDoc.ref.delete();
  return true;
};

// Export as a single service object
export const userService = {
  createUserInDb,
  authenticateUser,
  deleteUsersFromDb,
  fetchAndPopulateUsers,
  getAllUsersFromDb,
  deleteUserWithEmail,
};
