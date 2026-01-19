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

const getCurrentGameweek = async () => {
  try {
    console.log("Getting current gameweek...");

    // Get current time
    const currentTime = new Date();

    // 2 hours in milliseconds
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    // Get all fixtures
    const snap = await db.collection("fixtures").get();

    if (snap.empty) {
      throw new Error("No fixtures found in database");
    }

    const fixtures = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Get all unique gameweeks and sort them
    const gameweeks = [...new Set(fixtures.map((f) => f.event || f.gameweek))]
      .filter((gw) => gw != null)
      .sort((a, b) => a - b);

    // For each gameweek, find the first fixture time
    const gameweekFirstFixtures = gameweeks
      .map((gw) => {
        const gwFixtures = fixtures
          .filter((f) => (f.event || f.gameweek) === gw && f.kickoff_time)
          .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));

        return {
          gameweek: gw,
          firstFixtureTime:
            gwFixtures.length > 0 ? new Date(gwFixtures[0].kickoff_time) : null,
        };
      })
      .filter((gw) => gw.firstFixtureTime !== null);

    // Find the current gameweek based on deadline logic:
    // Current gameweek = the FIRST gameweek whose deadline has NOT passed yet
    // (i.e., the gameweek users should be making predictions for)
    // If all deadlines have passed, return the last gameweek

    let currentGameweek = gameweeks[gameweeks.length - 1]; // Default to last gameweek if all passed
    let deadlineTime = null;

    for (let i = 0; i < gameweekFirstFixtures.length; i++) {
      const gw = gameweekFirstFixtures[i];
      const timeUntilGW = gw.firstFixtureTime.getTime() - currentTime.getTime();

      // If we're NOT past the 2-hour deadline for this gameweek
      if (timeUntilGW > TWO_HOURS_MS) {
        currentGameweek = gw.gameweek;
        // Deadline is 2 hours before the first fixture
        deadlineTime = new Date(gw.firstFixtureTime.getTime() - TWO_HOURS_MS);
        break;
      }
    }

    console.log(`Current gameweek determined: GW${currentGameweek}`);
    console.log(
      `Deadline: ${deadlineTime ? deadlineTime.toISOString() : "N/A"}`
    );

    return {
      gameweek: currentGameweek,
      deadline: deadlineTime ? deadlineTime.toISOString() : null,
    };
  } catch (error) {
    console.error("Error in getCurrentGameweek service:", error);
    throw new Error("Failed to determine current gameweek");
  }
};

export default {
  listFixtures,
  deleteAllFixtures,
  populateFixtures,
  getFixtureById,
  getCurrentGameweek,
};
