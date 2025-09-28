import express from "express";
import axios from "axios";
import { db } from "../firestore.js";
const router = express.Router();

// GET /api/userPrdictions - list userPrdictions (limit 100)
// router.get("/", async (req, res) => {
//   if (!db) return res.status(500).json({ error: "Firestore not initialized" });
//   try {
//     const snap = await db.collection("userPrdictions").get();
//     const userPrdictions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
//     res.json({ userPrdictions });
//   } catch (err) {
//     console.error("Error listing userPrdictions:", err);
//     res.status(500).json({ error: "Failed to list userPrdictions" });
//   }
// });

// DELETE /api/userPrdictions - Delete all userPrdictions from db
router.delete("/", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const colRef = db.collection("userPrdictions");
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
    console.error("Error deleting userPrdictions:", err);
    res.status(500).json({
      error: "Failed to delete userPrdictions",
      details: err.message || String(err),
    });
  }
});

// GET /api/userPrdictions/:id
router.get("/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const snap = await db.collection("userPrdictions").doc(req.params.id).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Fixture not found" });
    }
    const userPrdictions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ userPrdictions });
  } catch (err) {
    console.error("Error listing userPrdictions:", err);
    res.status(500).json({ error: "Failed to list userPrdictions" });
  }
});

export default router;
