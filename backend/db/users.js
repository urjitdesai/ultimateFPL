const express = require("express");
const axios = require("axios");
const router = express.Router();
const { db } = require("../firestore");
const { getAuth, createUserWithEmailAndPassword } = require("firebase/auth");
const auth = getAuth();

// GET /api/users - list users
router.get("/", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const snap = await db.collection("users").get();
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("total users=", users.length);
    res.json({ users });
  } catch (err) {
    console.error("Error listing users:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// POST /api/users - create a new user
router.post("/", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const resp = await createUserWithEmailAndPassword(
      auth,
      req.body.email,
      req.body.password
    );
    const user = resp.user;
    res.status(201).json({ id: user.uid, email: user.email });
  } catch (err) {
    console.error("Error creating user:", err);
    res
      .status(500)
      .json({
        error: "Failed to create user",
        details: err.message || String(err),
      });
  }
});

// DELETE /api/users - Delete all users from db
router.delete("/", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const colRef = db.collection("users");
    const snap = await colRef.get();
    if (snap.empty) return res.json({ deleted: 0 });

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

    res.json({ deleted });
  } catch (err) {
    console.error("Error deleting users:", err);
    res.status(500).json({
      error: "Failed to delete users",
      details: err.message || String(err),
    });
  }
});

// POST /api/users/populate - fetch from remote BACKEND_API and write to Firestore
router.post("/populate", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });

  const backendApi = process.env.BACKEND_API;
  if (!backendApi) {
    return res
      .status(500)
      .json({ error: "BACKEND_API environment variable not defined" });
  }

  const url = `${backendApi.replace(/\/$/, "")}/users`;

  try {
    const resp = await axios.get(url, { timeout: 15000 });
    const users = Array.isArray(resp.data)
      ? resp.data
      : resp.data.users || resp.data;

    if (!Array.isArray(users)) {
      return res
        .status(500)
        .json({ error: "Unexpected users response format" });
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

    res.json({ inserted: totalWritten });
  } catch (err) {
    console.error("Error populating users:", err);
    res.status(500).json({
      error: "Failed to fetch or write users",
      details: err.message || String(err),
    });
  }
});

// GET /api/users/:id/predictions - get all userPredictions for a given user id
router.get("/:id/predictions", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  const userId = req.params.id;

  try {
    const docSnap = await db
      .collection("userPredictions")
      .where("userId", "==", userId)
      .get();
    if (docSnap.exists) {
      const predictions = docSnap.map((doc) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      res.status(200).json({ data: predictions });
    } else {
      res.status(200).json({ data: [] });
    }
  } catch (err) {
    console.error(`Error fetching user predictions for user ${userId}= ${err}`);
    res.status(500).json({
      error: "Failed to fetch user predictions",
      details: err.message || String(err),
    });
  }
});

module.exports = router;
