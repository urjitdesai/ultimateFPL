import { db } from "../../firestore.js";
import fixturesService from "../fixtures/fixtures.service.js";

// ============================================
// CONSTANTS
// ============================================

const MIN_WAGER = 10;
const MAX_WAGER_PER_FIXTURE = 100;
const MAX_WAGER_PER_GAMEWEEK = 100;

/**
 * H2H Wagers Service
 *
 * Collection: h2h_wagers
 * Document ID: {leagueId}_{userId}_{fixtureId}
 *
 * Fields:
 *   - leagueId: string
 *   - userId: string
 *   - fixtureId: number
 *   - gameweek: number
 *   - outcome: 'home' | 'draw' | 'away'
 *   - totalAmount: number (10-100, locked once set)
 *   - matchedAmount: number (portion matched against opponent)
 *   - unmatchedAmount: number (pending - voided/returned at kickoff)
 *   - status: 'pending' | 'partially_matched' | 'fully_matched' | 'resolved' | 'voided'
 *   - matches: [ { opponentUserId, amount, result: 'won'|'lost'|'pending', resolvedAt } ]
 *   - netPointsChange: number (final H2H gain/loss after resolution)
 *   - createdAt: timestamp
 *   - updatedAt: timestamp
 *
 * Collection: h2h_league_scores
 * Document ID: {leagueId}_{userId}
 *
 * Fields:
 *   - leagueId, userId, joinedGameweek, totalScore
 *   - gameweekScores: { '23': 15, '24': -10 }
 *   - wagersWon, wagersLost, wagersVoided
 *   - lastUpdatedGameweek, createdAt, updatedAt
 */

// ============================================
// HELPERS
// ============================================

/**
 * Determine the opposing outcome(s) for a given outcome
 */
const getOpposingOutcomes = (outcome) => {
  if (outcome === "home") return ["draw", "away"];
  if (outcome === "away") return ["draw", "home"];
  if (outcome === "draw") return ["home", "away"];
  return [];
};

/**
 * Determine match result winner from fixture scores
 * Returns 'home' | 'draw' | 'away'
 */
const getMatchResult = (teamHScore, teamAScore) => {
  if (teamHScore > teamAScore) return "home";
  if (teamHScore < teamAScore) return "away";
  return "draw";
};

/**
 * Validate that the fixture has not kicked off yet (wager deadline = kickoff)
 */
const validateWagerDeadline = async (fixtureId, gameweek) => {
  const fixtures = await fixturesService.getFixtureById(gameweek);
  const fixture = fixtures.find((f) => Number(f.id) === Number(fixtureId));

  if (!fixture) {
    throw new Error(`Fixture ${fixtureId} not found in gameweek ${gameweek}`);
  }

  if (fixture.started || fixture.finished) {
    throw new Error(
      "Wager deadline has passed. This fixture has already started."
    );
  }

  const kickoffTime = new Date(fixture.kickoff_time);
  if (new Date() >= kickoffTime) {
    throw new Error(
      "Wager deadline has passed. Kickoff time has been reached."
    );
  }

  return fixture;
};

/**
 * Get total wagered amount by a user in a given league + gameweek (excluding current fixture)
 */
const getTotalWageredThisGameweek = async (
  leagueId,
  userId,
  gameweek,
  excludeFixtureId = null
) => {
  const snapshot = await db
    .collection("h2h_wagers")
    .where("leagueId", "==", leagueId)
    .where("userId", "==", userId)
    .where("gameweek", "==", gameweek)
    .where("status", "!=", "voided")
    .get();

  let total = 0;
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (excludeFixtureId && Number(data.fixtureId) === Number(excludeFixtureId))
      return;
    total += data.totalAmount || 0;
  });
  return total;
};

// ============================================
// INITIALIZE H2H LEAGUE SCORE
// ============================================

const initializeUserH2HLeagueScore = async (leagueId, userId, joinedGameweek) => {
  const docId = `${leagueId}_${userId}`;
  const docRef = db.collection("h2h_league_scores").doc(docId);

  const existing = await docRef.get();
  if (existing.exists) {
    return { success: true, docId, alreadyExists: true };
  }

  await docRef.set({
    leagueId,
    userId,
    joinedGameweek: parseInt(joinedGameweek),
    totalScore: 0,
    gameweekScores: {},
    wagersWon: 0,
    wagersLost: 0,
    wagersVoided: 0,
    lastUpdatedGameweek: parseInt(joinedGameweek) - 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { success: true, docId };
};

// ============================================
// PLACE WAGER
// ============================================

const placeWager = async ({
  leagueId,
  userId,
  fixtureId,
  gameweek,
  outcome,
  amount,
}) => {
  // --- 1. Validate outcome ---
  if (!["home", "draw", "away"].includes(outcome)) {
    throw new Error("Invalid outcome. Must be 'home', 'draw', or 'away'.");
  }

  // --- 2. Validate amount range ---
  if (
    !Number.isInteger(amount) ||
    amount < MIN_WAGER ||
    amount > MAX_WAGER_PER_FIXTURE
  ) {
    throw new Error(
      `Wager amount must be between ${MIN_WAGER} and ${MAX_WAGER_PER_FIXTURE} points.`
    );
  }

  // --- 3. Validate fixture deadline ---
  await validateWagerDeadline(fixtureId, gameweek);

  // --- 4. Verify user is a member of this H2H league ---
  const membershipDoc = await db
    .collection("users_leagues")
    .where("userId", "==", userId)
    .where("league_id", "==", leagueId)
    .limit(1)
    .get();

  if (membershipDoc.empty) {
    throw new Error("You are not a member of this league.");
  }

  // --- 5. Verify league is of type 'h2h' ---
  const leagueDoc = await db.collection("leagues").doc(leagueId).get();
  if (!leagueDoc.exists) throw new Error("League not found.");
  const leagueData = leagueDoc.data();
  if (leagueData.leagueType !== "h2h") {
    throw new Error("This league is not a Head-to-Head league.");
  }

  // --- 6. Check weekly cap: total wagered this gameweek + this amount <= 100 ---
  const alreadyWagered = await getTotalWageredThisGameweek(
    leagueId,
    userId,
    gameweek,
    fixtureId
  );
  if (alreadyWagered + amount > MAX_WAGER_PER_GAMEWEEK) {
    const remaining = MAX_WAGER_PER_GAMEWEEK - alreadyWagered;
    throw new Error(
      `Gameweek wager cap reached. You can only wager ${remaining} more points this gameweek.`
    );
  }

  // --- 7. Check if wager already exists for this fixture (upsert) ---
  const docId = `${leagueId}_${userId}_${fixtureId}`;
  const wagerRef = db.collection("h2h_wagers").doc(docId);
  const existingWager = await wagerRef.get();

  if (existingWager.exists) {
    const data = existingWager.data();
    // Cannot change outcome once matched
    if (data.matchedAmount > 0 && data.outcome !== outcome) {
      throw new Error(
        "Cannot change outcome once part of your wager is matched."
      );
    }
    // Cannot reduce below already-matched amount
    if (amount < data.matchedAmount) {
      throw new Error(
        `Cannot reduce wager below matched amount (${data.matchedAmount} pts).`
      );
    }
  }

  // --- 8. Use Firestore transaction to place + attempt auto-match ---
  const result = await db.runTransaction(async (transaction) => {
    // Re-read inside transaction
    const wagerSnap = await transaction.get(wagerRef);

    let wagerData;
    if (wagerSnap.exists) {
      const existing = wagerSnap.data();
      const prevMatches = existing.matches || [];
      wagerData = {
        ...existing,
        outcome,
        totalAmount: amount,
        unmatchedAmount: amount - (existing.matchedAmount || 0),
        status:
          existing.matchedAmount >= amount
            ? "fully_matched"
            : existing.matchedAmount > 0
            ? "partially_matched"
            : "pending",
        updatedAt: new Date(),
        matches: prevMatches,
      };
    } else {
      wagerData = {
        leagueId,
        userId,
        fixtureId: Number(fixtureId),
        gameweek: Number(gameweek),
        outcome,
        totalAmount: amount,
        matchedAmount: 0,
        unmatchedAmount: amount,
        status: "pending",
        netPointsChange: null,
        matches: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // --- 9. Find opposing wagers to match against ---
    const opposingOutcomes = getOpposingOutcomes(outcome);
    const opposingSnapshot = await db
      .collection("h2h_wagers")
      .where("leagueId", "==", leagueId)
      .where("fixtureId", "==", Number(fixtureId))
      .where("gameweek", "==", Number(gameweek))
      .where("status", "in", ["pending", "partially_matched"])
      .get();

    const opposingWagers = opposingSnapshot.docs
      .filter(
        (doc) =>
          doc.id !== docId &&
          opposingOutcomes.includes(doc.data().outcome) &&
          doc.data().userId !== userId
      )
      .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }));

    let remainingToMatch = wagerData.unmatchedAmount;
    const updatedOpponents = [];

    for (const opp of opposingWagers) {
      if (remainingToMatch <= 0) break;

      const oppData = opp.data;
      const oppAvailable = oppData.unmatchedAmount || 0;
      if (oppAvailable <= 0) continue;

      const matchAmount = Math.min(remainingToMatch, oppAvailable);

      // Update opponent wager
      const newOppMatchedAmount = (oppData.matchedAmount || 0) + matchAmount;
      const newOppUnmatched = oppData.totalAmount - newOppMatchedAmount;
      const updatedOppMatches = [
        ...(oppData.matches || []),
        {
          opponentUserId: userId,
          amount: matchAmount,
          result: "pending",
          resolvedAt: null,
        },
      ];

      updatedOpponents.push({
        ref: opp.ref,
        update: {
          matchedAmount: newOppMatchedAmount,
          unmatchedAmount: newOppUnmatched,
          status:
            newOppUnmatched <= 0 ? "fully_matched" : "partially_matched",
          matches: updatedOppMatches,
          updatedAt: new Date(),
        },
      });

      // Update our wager record
      wagerData.matches.push({
        opponentUserId: oppData.userId,
        amount: matchAmount,
        result: "pending",
        resolvedAt: null,
      });
      wagerData.matchedAmount = (wagerData.matchedAmount || 0) + matchAmount;
      remainingToMatch -= matchAmount;
    }

    wagerData.unmatchedAmount = remainingToMatch;
    wagerData.status =
      wagerData.matchedAmount >= wagerData.totalAmount
        ? "fully_matched"
        : wagerData.matchedAmount > 0
        ? "partially_matched"
        : "pending";

    // Write all updates
    transaction.set(wagerRef, wagerData, { merge: false });
    for (const { ref, update } of updatedOpponents) {
      transaction.update(ref, update);
    }

    return {
      docId,
      outcome,
      totalAmount: wagerData.totalAmount,
      matchedAmount: wagerData.matchedAmount,
      unmatchedAmount: wagerData.unmatchedAmount,
      status: wagerData.status,
      matchesCount: wagerData.matches.length,
    };
  });

  return result;
};

// ============================================
// GET USER WAGERS FOR GAMEWEEK
// ============================================

const getUserWagersForGameweek = async (leagueId, userId, gameweek) => {
  const snapshot = await db
    .collection("h2h_wagers")
    .where("leagueId", "==", leagueId)
    .where("userId", "==", userId)
    .where("gameweek", "==", Number(gameweek))
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ============================================
// GET ALL WAGERS FOR FIXTURE (admin view)
// ============================================

const getWagersForFixture = async (leagueId, fixtureId) => {
  const snapshot = await db
    .collection("h2h_wagers")
    .where("leagueId", "==", leagueId)
    .where("fixtureId", "==", Number(fixtureId))
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ============================================
// RESOLVE WAGERS (called after gameweek fixtures finish)
// ============================================

/**
 * Resolves all H2H wagers for a given gameweek in a league.
 * - Voids unmatched portions (returns points to users implicitly - no deduction since wagers
 *   are tracked separately from main balance)
 * - For matched portions: awards winner, penalises loser
 * - Sanity check: loser's H2H score for that gameweek cannot make totalScore go below 0
 */
const resolveGameweekWagers = async (leagueId, gameweek) => {
  // --- 1. Fetch all fixtures for this gameweek ---
  const fixtures = await fixturesService.getFixtureById(gameweek);
  const fixtureMap = new Map(
    fixtures.map((f) => [Number(f.id), f])
  );

  // Ensure all fixtures are finished
  const unfinished = fixtures.filter((f) => !f.finished);
  if (unfinished.length > 0) {
    throw new Error(
      `Cannot resolve: ${unfinished.length} fixture(s) in gameweek ${gameweek} are not finished yet.`
    );
  }

  // --- 2. Fetch all pending/matched wagers for this gameweek + league ---
  const wagersSnapshot = await db
    .collection("h2h_wagers")
    .where("leagueId", "==", leagueId)
    .where("gameweek", "==", Number(gameweek))
    .where("status", "in", ["pending", "partially_matched", "fully_matched"])
    .get();

  if (wagersSnapshot.empty) {
    return { resolved: 0, voided: 0, message: "No wagers to resolve." };
  }

  // --- 3. Collect per-user net point changes ---
  // Map: userId -> netChange
  const userNetChanges = new Map();

  const batchUpdates = [];

  for (const doc of wagersSnapshot.docs) {
    const wager = doc.data();
    const fixture = fixtureMap.get(Number(wager.fixtureId));

    if (!fixture) {
      // Fixture not found - void this wager
      batchUpdates.push({
        ref: doc.ref,
        update: { status: "voided", updatedAt: new Date() },
      });
      continue;
    }

    const actualResult = getMatchResult(
      fixture.team_h_score,
      fixture.team_a_score
    );

    // Tally up net change from matched portions
    let netChange = 0;
    const resolvedMatches = (wager.matches || []).map((match) => {
      let matchResult;
      if (wager.outcome === actualResult) {
        matchResult = "won";
        netChange += match.amount;
      } else {
        matchResult = "lost";
        netChange -= match.amount;
      }
      return { ...match, result: matchResult, resolvedAt: new Date() };
    });

    // Unmatched amount is voided (returned - no net change for that portion)
    const existing = userNetChanges.get(wager.userId) || 0;
    userNetChanges.set(wager.userId, existing + netChange);

    batchUpdates.push({
      ref: doc.ref,
      update: {
        matches: resolvedMatches,
        netPointsChange: netChange,
        status: "resolved",
        updatedAt: new Date(),
      },
    });
  }

  // --- 4. Sanity check: no user's h2h totalScore should go below 0 ---
  for (const [userId, netChange] of userNetChanges.entries()) {
    if (netChange >= 0) continue; // winning, no issue

    const scoreDocId = `${leagueId}_${userId}`;
    const scoreDoc = await db
      .collection("h2h_league_scores")
      .doc(scoreDocId)
      .get();

    const currentTotal = scoreDoc.exists ? scoreDoc.data().totalScore || 0 : 0;
    if (currentTotal + netChange < 0) {
      // Cap the loss so total doesn't go negative
      userNetChanges.set(userId, -currentTotal); // lose only what they have
    }
  }

  // --- 5. Write wager resolutions in batches ---
  const BATCH_SIZE = 400;
  for (let i = 0; i < batchUpdates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    batchUpdates.slice(i, i + BATCH_SIZE).forEach(({ ref, update }) => {
      batch.update(ref, update);
    });
    await batch.commit();
  }

  // --- 6. Update h2h_league_scores for each user ---
  const scoreUpdatePromises = [];
  for (const [userId, netChange] of userNetChanges.entries()) {
    const scoreDocId = `${leagueId}_${userId}`;
    const scoreDocRef = db.collection("h2h_league_scores").doc(scoreDocId);

    scoreUpdatePromises.push(
      db.runTransaction(async (t) => {
        const scoreSnap = await t.get(scoreDocRef);
        if (!scoreSnap.exists) return;

        const data = scoreSnap.data();
        const prevTotal = data.totalScore || 0;
        const prevGWScores = data.gameweekScores || {};
        const prevGWScore = prevGWScores[gameweek.toString()] || 0;

        const newGWScore = prevGWScore + netChange;
        const newTotal = Math.max(0, prevTotal + netChange); // hard floor at 0

        t.update(scoreDocRef, {
          totalScore: newTotal,
          [`gameweekScores.${gameweek}`]: newGWScore,
          wagersWon:
            (data.wagersWon || 0) + (netChange > 0 ? 1 : 0),
          wagersLost:
            (data.wagersLost || 0) + (netChange < 0 ? 1 : 0),
          lastUpdatedGameweek: Number(gameweek),
          updatedAt: new Date(),
        });
      })
    );
  }

  await Promise.all(scoreUpdatePromises);

  return {
    resolved: batchUpdates.filter((u) => u.update.status === "resolved").length,
    voided: batchUpdates.filter((u) => u.update.status === "voided").length,
    usersAffected: userNetChanges.size,
  };
};

// ============================================
// VOID UNMATCHED WAGERS AT KICKOFF
// ============================================

/**
 * Called at kickoff time for a fixture - voids any still-pending unmatched amounts.
 * The wager itself becomes resolved/voided for unmatched portions.
 * This is separate from resolveGameweekWagers (which handles outcomes).
 */
const voidUnmatchedWagersForFixture = async (leagueId, fixtureId, gameweek) => {
  const snapshot = await db
    .collection("h2h_wagers")
    .where("leagueId", "==", leagueId)
    .where("fixtureId", "==", Number(fixtureId))
    .where("gameweek", "==", Number(gameweek))
    .get();

  if (snapshot.empty) return { updated: 0 };

  const batch = db.batch();
  let updated = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.status === "voided" || data.status === "resolved") return;

    if (data.unmatchedAmount > 0) {
      const newStatus =
        data.matchedAmount > 0 ? "fully_matched" : "voided";
      batch.update(doc.ref, {
        unmatchedAmount: 0,
        status: newStatus,
        updatedAt: new Date(),
      });
      updated++;
    }
  });

  await batch.commit();
  return { updated };
};

// ============================================
// GET H2H LEAGUE TABLE
// ============================================

const getH2HLeagueTable = async (leagueId) => {
  const snapshot = await db
    .collection("h2h_league_scores")
    .where("leagueId", "==", leagueId)
    .get();

  if (snapshot.empty) return [];

  // Fetch user names
  const userIds = snapshot.docs.map((doc) => doc.data().userId);
  const userDocs = await Promise.all(
    userIds.map((uid) => db.collection("users").doc(uid).get())
  );
  const userMap = new Map();
  userDocs.forEach((doc) => {
    if (doc.exists) {
      const d = doc.data();
      userMap.set(doc.id, d.display_name || d.email || "Unknown");
    }
  });

  const entries = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      userId: data.userId,
      userName: userMap.get(data.userId) || "Unknown",
      totalScore: data.totalScore || 0,
      wagersWon: data.wagersWon || 0,
      wagersLost: data.wagersLost || 0,
      wagersVoided: data.wagersVoided || 0,
      gameweekScores: data.gameweekScores || {},
      joinedGameweek: data.joinedGameweek,
      lastUpdatedGameweek: data.lastUpdatedGameweek,
    };
  });

  // Sort by totalScore descending
  entries.sort((a, b) => b.totalScore - a.totalScore);

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
};

// ============================================
// GET USER H2H WAGER SUMMARY FOR GAMEWEEK
// ============================================

const getUserGameweekWagerSummary = async (leagueId, userId, gameweek) => {
  const wagers = await getUserWagersForGameweek(leagueId, userId, gameweek);

  const totalWagered = wagers
    .filter((w) => w.status !== "voided")
    .reduce((sum, w) => sum + (w.totalAmount || 0), 0);

  const remainingCap = Math.max(0, MAX_WAGER_PER_GAMEWEEK - totalWagered);

  return {
    wagers,
    totalWagered,
    remainingCap,
    maxWagerPerFixture: MAX_WAGER_PER_FIXTURE,
    minWager: MIN_WAGER,
    weeklyCapTotal: MAX_WAGER_PER_GAMEWEEK,
  };
};

export const h2hWagersService = {
  placeWager,
  getUserWagersForGameweek,
  getWagersForFixture,
  resolveGameweekWagers,
  voidUnmatchedWagersForFixture,
  getH2HLeagueTable,
  initializeUserH2HLeagueScore,
  getUserGameweekWagerSummary,
  CONSTANTS: { MIN_WAGER, MAX_WAGER_PER_FIXTURE, MAX_WAGER_PER_GAMEWEEK },
};

export default h2hWagersService;
