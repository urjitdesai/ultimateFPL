export type SyncPolicyFixture = {
  kickoffAtMillis: number;
};

export type SyncPolicyIntervals = {
  idle: number;
  live: number;
  recent: number;
};

const LIVE_WINDOW_BEFORE_KICKOFF_MS = 30 * 60 * 1000;
const LIVE_WINDOW_AFTER_KICKOFF_MS = 4 * 60 * 60 * 1000;
const RECENT_WINDOW_AFTER_KICKOFF_MS = 12 * 60 * 60 * 1000;

export function requiredSyncInterval(
  fixtures: SyncPolicyFixture[],
  nowMillis: number,
  intervals: SyncPolicyIntervals,
) {
  const live = fixtures.some(({ kickoffAtMillis }) =>
    kickoffAtMillis <= nowMillis + LIVE_WINDOW_BEFORE_KICKOFF_MS
    && kickoffAtMillis >= nowMillis - LIVE_WINDOW_AFTER_KICKOFF_MS);
  if (live) return intervals.live;

  const recent = fixtures.some(({ kickoffAtMillis }) =>
    kickoffAtMillis < nowMillis - LIVE_WINDOW_AFTER_KICKOFF_MS
    && kickoffAtMillis >= nowMillis - RECENT_WINDOW_AFTER_KICKOFF_MS);
  return recent ? intervals.recent : intervals.idle;
}

export function providerSyncIsDue(
  fixtures: SyncPolicyFixture[],
  lastSyncedAtMillis: number | null,
  nowMillis: number,
  intervals: SyncPolicyIntervals,
) {
  if (lastSyncedAtMillis == null) return true;
  return nowMillis - lastSyncedAtMillis >= requiredSyncInterval(fixtures, nowMillis, intervals);
}

export function gameweekRequiresScoring(
  status: "UPCOMING" | "ACTIVE" | "COMPLETE",
  hasPendingFixture: boolean,
  finalizedFingerprint: string | null | undefined,
  currentFingerprint: string,
) {
  if (status === "UPCOMING") return false;
  return hasPendingFixture || (status === "COMPLETE" && finalizedFingerprint !== currentFingerprint);
}
