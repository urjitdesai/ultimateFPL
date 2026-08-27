const GAMEWEEK_LOCK_LEAD_MS = 60 * 60 * 1000;

export function gameweekLockDeadline(startsAt: string | Date) {
  return new Date(startsAt).getTime() - GAMEWEEK_LOCK_LEAD_MS;
}

export function gameweekSubmissionIsLocked(
  startsAt: string | Date,
  nowMillis = Date.now(),
) {
  return nowMillis >= gameweekLockDeadline(startsAt);
}
