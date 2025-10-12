// import express from "express";
import axios from "axios";
import { db } from "../../firestore.js";

const getFixtureById = async (eventId) => {
  const snap = await db
    .collection("fixtures")
    .where("event", "==", parseInt(eventId))
    .get();
  if (snap.empty) {
    throw new Error("Fixture not found");
  }
  const fixtures = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return fixtures;
};

const populateFixtures = async (eventId) => {
  const backendApi = process.env.BACKEND_API;
  if (!backendApi) {
    throw new Error("BACKEND_API environment variable not defined");
  }
  const url = `${backendApi.replace(/\/$/, "")}/fixtures`;

  try {
    const resp = await axios.get(url, { timeout: 15000 });
    console.log("resp.data= ", resp.data);
    const fixtures = Array.isArray(resp.data)
      ? resp.data
      : resp.data.fixtures || resp.data;

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
    return { inserted: totalWritten };
  } catch (err) {
    console.error("Error populating fixtures:", err);
    throw new Error("Failed to fetch or write fixtures");
  }
};

const deleteAllFixtures = async () => {
  const colRef = db.collection("fixtures");
  const snap = await colRef.get();
  if (snap.empty) return { deleted: 0 };
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

  return { deleted };
};

const listFixtures = async () => {
  const snap = await db.collection("fixtures").get();
  const fixtures = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return fixtures;
};

export default {
  listFixtures,
  deleteAllFixtures,
  populateFixtures,
  getFixtureById,
};
