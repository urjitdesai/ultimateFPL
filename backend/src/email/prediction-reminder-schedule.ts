const HOUR_MS = 60 * 60 * 1000;
const REMINDER_WINDOW_MS = 5 * 60 * 1000;

export const PREDICTION_REMINDER_SCHEDULES = [
  { key: "24h", hoursBeforeDeadline: 24, leadTimeMs: 24 * HOUR_MS },
  { key: "2h", hoursBeforeDeadline: 2, leadTimeMs: 2 * HOUR_MS },
] as const;

export function predictionReminderSchedulesDue(deadline: number, now: number) {
  const timeUntilDeadline = deadline - now;
  if (timeUntilDeadline <= 0) return [];

  return PREDICTION_REMINDER_SCHEDULES.filter((schedule) =>
    timeUntilDeadline <= schedule.leadTimeMs
      && timeUntilDeadline > schedule.leadTimeMs - REMINDER_WINDOW_MS);
}
