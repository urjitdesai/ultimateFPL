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

/**
 * Fetch fixtures from remote API and write to Firestore
 * @param {number|null} gameweek - Optional gameweek to fetch. If null, fetches all fixtures.
 * @returns {Object} Result with inserted count
 */
const populateFixtures = async (gameweek = null) => {
  const backendApi = process.env.BACKEND_API;
  if (!backendApi) {
    throw new Error("BACKEND_API environment variable not defined");
  }

  // Build URL - add event parameter if gameweek is specified
  let url = `${backendApi.replace(/\/$/, "")}/fixtures`;
  if (gameweek !== null) {
    url += `?event=${gameweek}`;
  }

  try {
    console.log(`[FIXTURES] Fetching fixtures from: ${url}`);
    const resp = await axios.get(url, { timeout: 15000 });

    let fixtures = Array.isArray(resp.data)
      ? resp.data
      : resp.data.fixtures || resp.data;

    // If fetching all fixtures but filtering by gameweek (fallback if API doesn't support event param)
    if (
      gameweek !== null &&
      fixtures.length > 0 &&
      fixtures[0].event !== undefined
    ) {
      const originalCount = fixtures.length;
      fixtures = fixtures.filter((f) => f.event === parseInt(gameweek, 10));
      console.log(
        `[FIXTURES] Filtered ${originalCount} fixtures to ${fixtures.length} for gameweek ${gameweek}`
      );
    }

    if (fixtures.length === 0) {
      console.log(
        `[FIXTURES] No fixtures found${
          gameweek ? ` for gameweek ${gameweek}` : ""
        }`
      );
      return { inserted: 0, gameweek };
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

    console.log(
      `[FIXTURES] Insertion complete. ${totalWritten} fixtures written${
        gameweek ? ` for gameweek ${gameweek}` : ""
      }`
    );
    return { inserted: totalWritten, gameweek };
  } catch (err) {
    console.error("Error populating fixtures:", err);
    throw new Error(
      `Failed to fetch or write fixtures${
        gameweek ? ` for gameweek ${gameweek}` : ""
      }`
    );
  }
};

/**
 * Populate fixtures for a specific gameweek
 * @param {number} gameweek - The gameweek number (1-38)
 * @returns {Object} Result with inserted count
 */
const populateFixturesForGameweek = async (gameweek) => {
  if (!gameweek || gameweek < 1 || gameweek > 38) {
    throw new Error("Valid gameweek (1-38) is required");
  }
  return populateFixtures(parseInt(gameweek, 10));
};

/**
 * Populate fixtures for a range of gameweeks
 * @param {number} startGameweek - Starting gameweek
 * @param {number} endGameweek - Ending gameweek (inclusive)
 * @returns {Object} Results for each gameweek
 */
const populateFixturesForRange = async (startGameweek, endGameweek) => {
  if (
    !startGameweek ||
    !endGameweek ||
    startGameweek < 1 ||
    endGameweek > 38 ||
    startGameweek > endGameweek
  ) {
    throw new Error(
      "Valid startGameweek and endGameweek (1-38, start <= end) are required"
    );
  }

  const results = {
    startGameweek,
    endGameweek,
    gameweekResults: [],
    totalInserted: 0,
  };

  for (let gw = startGameweek; gw <= endGameweek; gw++) {
    try {
      const gwResult = await populateFixtures(gw);
      results.gameweekResults.push(gwResult);
      results.totalInserted += gwResult.inserted;
    } catch (error) {
      results.gameweekResults.push({
        gameweek: gw,
        error: error.message,
        inserted: 0,
      });
    }
  }

  return results;
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
  populateFixturesForGameweek,
  populateFixturesForRange,
  getFixtureById,
  getCurrentGameweek,
};
