import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import { firestore } from "../firebase/admin.js";
import { getGameweeks, type Gameweek } from "../gameweeks/gameweeks.service.js";
import { gameweekLockDeadline } from "../gameweeks/gameweek-deadline.js";
import { sendEmail } from "./email.service.js";
import { gameweekResultsEmail, predictionReminderEmail } from "./email-templates.js";
import { predictionReminderSchedulesDue } from "./prediction-reminder-schedule.js";
import { usersWithCompleteGameweekSubmission } from "./submission-status.js";

function userWantsEmail(data: FirebaseFirestore.DocumentData) {
  return typeof data.email === "string" && data.email.includes("@")
    && data.emailNotifications?.unsubscribed !== true
    && data.emailNotifications?.enabled !== false;
}

async function users() {
  const snapshot = await firestore.collection("users").get();
  return snapshot.docs.filter((doc) => userWantsEmail(doc.data()));
}

type NotificationType = "PREDICTION_REMINDER" | "GAMEWEEK_RESULTS";

type QueuedEmail = {
  userId: string;
  gameweekId: string;
  notificationType: NotificationType;
  to: string;
  subject: string;
  html: string;
  text: string;
  reminderLeadHours?: 2 | 24;
};

async function queue(id: string, input: QueuedEmail) {
  const reference = firestore.collection("emailOutbox").doc(id);
  const existing = await reference.get();
  if (!existing.exists) await reference.create({ ...input, status: "PENDING", attempts: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}

async function submittedUserIds(gameweekId: string) {
  const [fixtures, predictions] = await Promise.all([
    firestore.collection("fixtures").where("gameweekId", "==", gameweekId).get(),
    firestore.collection("predictions").where("gameweekId", "==", gameweekId).get(),
  ]);

  return usersWithCompleteGameweekSubmission(
    fixtures.docs.map((fixture) => fixture.id),
    predictions.docs.flatMap((prediction) => {
      const data = prediction.data();
      return typeof data.userId === "string" && typeof data.fixtureId === "string"
        ? [{ userId: data.userId, fixtureId: data.fixtureId, submitted: data.submittedAt != null }]
        : [];
    }),
  );
}

function reminderGameweekId(documentId: string, data: FirebaseFirestore.DocumentData) {
  if (data.notificationType === "PREDICTION_REMINDER" && typeof data.gameweekId === "string") {
    return data.gameweekId;
  }
  if (typeof data.userId !== "string") return null;
  const legacyPrefix = `prediction-reminder_${data.userId}_`;
  return documentId.startsWith(legacyPrefix) ? documentId.slice(legacyPrefix.length) : null;
}

export async function queuePredictionReminders(now = Date.now()) {
  if (!env.EMAIL_NOTIFICATIONS_ENABLED) return 0;
  const gameweeks = await getGameweeks();
  const candidates = gameweeks.filter((gameweek) => gameweek.status === "UPCOMING" || gameweek.status === "ACTIVE")
    .flatMap((gameweek) => {
      const deadline = new Date(gameweekLockDeadline(gameweek.startsAt)).getTime();
      return predictionReminderSchedulesDue(deadline, now)
        .map((schedule) => ({ gameweek, schedule }));
    });
  if (candidates.length === 0) return 0;
  const recipients = await users();
  let queued = 0;
  for (const { gameweek, schedule } of candidates) {
    const alreadySubmitted = await submittedUserIds(gameweek.id);
    for (const recipient of recipients) {
      const data = recipient.data();
      const joined = Number(data.joinedGameweek ?? 0);
      if (joined > gameweek.roundNumber || alreadySubmitted.has(recipient.id)) continue;
      const email = predictionReminderEmail({
        roundNumber: gameweek.roundNumber,
        hoursBeforeDeadline: schedule.hoursBeforeDeadline,
        recipientName: data.firstName ?? data.managerName ?? "there",
        dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
      });
      await queue(`prediction-reminder_${schedule.key}_${recipient.id}_${gameweek.id}`, {
        userId: recipient.id,
        gameweekId: gameweek.id,
        notificationType: "PREDICTION_REMINDER",
        reminderLeadHours: schedule.hoursBeforeDeadline,
        to: data.email as string,
        ...email,
      });
      queued += 1;
    }
  }
  return queued;
}

export async function queueGameweekResults(gameweeks: Gameweek[]) {
  if (!env.EMAIL_NOTIFICATIONS_ENABLED || gameweeks.length === 0) return 0;
  const recipients = await users();
  let queued = 0;
  for (const gameweek of gameweeks) for (const recipient of recipients) {
    const data = recipient.data();
    if (Number(data.joinedGameweek ?? 0) > gameweek.roundNumber) continue;
    const email = gameweekResultsEmail({
      roundNumber: gameweek.roundNumber,
      recipientName: data.firstName ?? data.managerName ?? "there",
      dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
    });
    await queue(`gameweek-results_${recipient.id}_${gameweek.id}`, {
      userId: recipient.id,
      gameweekId: gameweek.id,
      notificationType: "GAMEWEEK_RESULTS",
      to: data.email as string,
      ...email,
    });
    queued += 1;
  }
  return queued;
}

export async function deliverPendingEmails(limit = 50) {
  if (!env.EMAIL_NOTIFICATIONS_ENABLED) return { sent: 0, failed: 0, cancelled: 0 };
  const [pending, failedSnapshot] = await Promise.all([
    firestore.collection("emailOutbox").where("status", "==", "PENDING").limit(limit).get(),
    firestore.collection("emailOutbox").where("status", "==", "FAILED").limit(limit).get(),
  ]);
  const documents = [...pending.docs, ...failedSnapshot.docs]
    .filter((document) => Number(document.data().attempts ?? 0) < 3)
    .slice(0, limit);
  const reminderGameweeks = new Map(documents.flatMap((document) => {
    const gameweekId = reminderGameweekId(document.id, document.data());
    return gameweekId ? [[document.id, gameweekId] as const] : [];
  }));
  const submittedByGameweek = new Map(await Promise.all(
    [...new Set(reminderGameweeks.values())].map(async (gameweekId) =>
      [gameweekId, await submittedUserIds(gameweekId)] as const),
  ));

  let sent = 0; let failed = 0; let cancelled = 0;
  for (const document of documents) {
    const data = document.data();
    const gameweekId = reminderGameweeks.get(document.id);
    if (gameweekId && submittedByGameweek.get(gameweekId)?.has(data.userId as string)) {
      await document.ref.set({
        status: "CANCELLED",
        cancellationReason: "PREDICTIONS_SUBMITTED",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      cancelled += 1;
      continue;
    }
    try {
      const result = await sendEmail({ to: data.to as string, subject: data.subject as string, html: data.html as string, text: data.text as string });
      await document.ref.set({ status: "SENT", providerMessageId: result.skipped ? null : result.provider.id ?? null, sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      sent += 1;
    } catch (error) {
      failed += 1;
      const attempts = Number(data.attempts ?? 0) + 1;
      await document.ref.set({ status: attempts >= 3 ? "FAILED" : "PENDING", attempts, error: error instanceof Error ? error.message : "Email delivery failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  return { sent, failed, cancelled };
}
