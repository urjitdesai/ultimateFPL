import jwt from "jsonwebtoken";
import { db } from "../../firestore.js";
import axios from "axios";
import admin from "firebase-admin";
import bcrypt from "bcrypt";

export const authenticateUser = async (email, password) => {
  if (!db) throw new Error("Firestore not initialized");
  // Fetch user from Firestore
  console.log("email=", email);
  console.log("password=", password);
  const userSnap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (userSnap.empty) throw new Error("Invalid email or password");

  const user = userSnap.docs[0].data();
  console.log("user= ", user);

  // Verify password (assuming password is stored securely, e.g., hashed)
  if (user.password !== password)
    // Replace with proper hash comparison
    throw new Error("Invalid email or password");

  // Generate JWT token
  return jwt.sign({ userId: user.user_id }, "your_jwt_secret", {
    expiresIn: "1h",
  });
};

export const deleteUsersFromDb = async () => {
  if (!db) throw new Error("Firestore not initialized");

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

export const fetchAndPopulateUsers = async () => {
  if (!db) throw new Error("Firestore not initialized");

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

export const createUserInDb = async (email, password, displayName) => {
  if (!db) throw new Error("Firestore not initialized");
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
  const docRef = await db.collection("users").add({
    email: email,
    display_name: displayName || null,
    password: passwordHash,
  });

  return { id: docRef.id, email: email };
};
