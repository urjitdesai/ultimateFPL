import express from "express";
import axios from "axios";
import { db } from "../firestore.js";
const router = express.Router();

// GET /api/fixtures - list fixtures (limit 100)
router.get("/", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const snap = await db.collection("fixtures").get();
    const fixtures = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ fixtures });
  } catch (err) {
    console.error("Error listing fixtures:", err);
    res.status(500).json({ error: "Failed to list fixtures" });
  }
});

// DELETE /api/fixtures - Delete all fixtures from db
router.delete("/", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const colRef = db.collection("fixtures");
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
    console.error("Error deleting fixtures:", err);
    res.status(500).json({
      error: "Failed to delete fixtures",
      details: err.message || String(err),
    });
  }
});

// POST /api/fixtures/populate - fetch from remote BACKEND_API and write to Firestore
router.post("/populate", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });

  const backendApi = process.env.BACKEND_API;
  if (!backendApi) {
    return res
      .status(500)
      .json({ error: "BACKEND_API environment variable not defined" });
  }

  const url = `${backendApi.replace(/\/$/, "")}/fixtures`;

  try {
    const resp = await axios.get(url, { timeout: 15000 });
    console.log("resp.data= ", resp.data);

    const fixtures = Array.isArray(resp.data)
      ? resp.data
      : resp.data.fixtures || resp.data;

    if (!Array.isArray(fixtures)) {
      return res
        .status(500)
        .json({ error: "Unexpected fixtures response format" });
    }

    // Firestore batch limit is 500; chunk into batches of 400 to be safe
    const chunkSize = 400;
    let totalWritten = 0;

    for (let i = 0; i < fixtures.length; i += chunkSize) {
      const chunk = fixtures.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach((f) => {
        const docId = f.id.toString();
        const docRef = db.collection("fixtures").doc(docId);
        batch.set(docRef, f, { merge: true });
      });
      await batch.commit();
      totalWritten += chunk.length;
    }
    console.log("Insertion complete.");

    res.json({ inserted: totalWritten });
  } catch (err) {
    console.error("Error populating fixtures:", err);
    res.status(500).json({
      error: "Failed to fetch or write fixtures",
      details: err.message || String(err),
    });
  }
});

// GET /api/fixtures/:id - get fixture by gameweek id
router.get("/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  console.log("req.params.id=", req.params.id);

  try {
    const snap = await db
      .collection("fixtures")
      .where("event", "==", parseInt(req.params.id))
      .get();
    if (snap.empty) {
      return res.status(404).json({ error: "Fixture not found" });
    }
    const fixtures = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ fixtures });
  } catch (err) {
    console.error("Error listing fixtures:", err);
    res.status(500).json({ error: "Failed to list fixtures" });
  }
});

export default router;
