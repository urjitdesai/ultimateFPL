import { describe, expect, it } from "vitest";
import { predictionReminderSchedulesDue } from "./prediction-reminder-schedule.js";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe("prediction reminder schedule", () => {
  it("schedules a reminder 24 hours before the prediction deadline", () => {
    const deadline = 30 * HOUR_MS;

    expect(predictionReminderSchedulesDue(deadline, deadline - 24 * HOUR_MS)
      .map((schedule) => schedule.key)).toEqual(["24h"]);
    expect(predictionReminderSchedulesDue(deadline, deadline - 24 * HOUR_MS + 4 * MINUTE_MS)
      .map((schedule) => schedule.key)).toEqual(["24h"]);
  });

  it("schedules a separate reminder 2 hours before the prediction deadline", () => {
    const deadline = 30 * HOUR_MS;

    expect(predictionReminderSchedulesDue(deadline, deadline - 2 * HOUR_MS)
      .map((schedule) => schedule.key)).toEqual(["2h"]);
  });

  it("does not schedule reminders outside their five-minute windows", () => {
    const deadline = 30 * HOUR_MS;

    expect(predictionReminderSchedulesDue(deadline, deadline - 24 * HOUR_MS - MINUTE_MS)).toEqual([]);
    expect(predictionReminderSchedulesDue(deadline, deadline - 24 * HOUR_MS + 5 * MINUTE_MS)).toEqual([]);
    expect(predictionReminderSchedulesDue(deadline, deadline - HOUR_MS)).toEqual([]);
  });
});
