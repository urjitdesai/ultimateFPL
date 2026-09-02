import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import { firestore } from "../firebase/admin.js";
import { getGameweeks, type Gameweek } from "../gameweeks/gameweeks.service.js";
import { gameweekLockDeadline } from "../gameweeks/gameweek-deadline.js";
import { sendEmail } from "./email.service.js";

const TWO_HOURS = 2 * 60 * 60 * 1000;
const REMINDER_WINDOW = 5 * 60 * 1000;

function userWantsEmail(data: FirebaseFirestore.DocumentData) {
  return typeof data.email === "string" && data.email.includes("@")
    && data.emailNotifications?.unsubscribed !== true
    && data.emailNotifications?.enabled !== false;
}

async function users() {
  const snapshot = await firestore.collection("users").get();
  return snapshot.docs.filter((doc) => userWantsEmail(doc.data()));
}

async function queue(id: string, input: { userId: string; to: string; subject: string; html: string; text: string }) {
  const reference = firestore.collection("emailOutbox").doc(id);
  const existing = await reference.get();
  if (!existing.exists) await reference.create({ ...input, status: "PENDING", attempts: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}

export async function queuePredictionReminders(now = Date.now()) {
  if (!env.EMAIL_NOTIFICATIONS_ENABLED) return 0;
  const gameweeks = await getGameweeks();
  const candidates = gameweeks.filter((gameweek) => gameweek.status === "UPCOMING" || gameweek.status === "ACTIVE")
    .map((gameweek) => ({ gameweek, deadline: new Date(gameweekLockDeadline(gameweek.startsAt)).getTime() }))
    .filter(({ deadline }) => deadline > now && deadline - now <= TWO_HOURS && deadline - now > TWO_HOURS - REMINDER_WINDOW);
  if (candidates.length === 0) return 0;
  const recipients = await users();
  let queued = 0;
  for (const { gameweek } of candidates) for (const recipient of recipients) {
    const data = recipient.data();
    const joined = Number(data.joinedGameweek ?? 0);
    if (joined > gameweek.roundNumber) continue;
    await queue(`prediction-reminder_${recipient.id}_${gameweek.id}`, {
      userId: recipient.id,
      to: data.email as string,
      subject: `Gameweek ${gameweek.roundNumber} predictions close soon`,
      html: `<p>Hi ${data.firstName ?? data.managerName ?? "there"},</p><p>Your Gameweek ${gameweek.roundNumber} prediction deadline is in about two hours.</p><p>Open <a href="${env.FRONTEND_URL}/dashboard">Predictions Premier League</a> to make your calls.</p>`,
      text: `Your Gameweek ${gameweek.roundNumber} prediction deadline is in about two hours. Visit ${env.FRONTEND_URL}/dashboard to make your calls.`,
    });
    queued += 1;
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
    await queue(`gameweek-results_${recipient.id}_${gameweek.id}`, {
      userId: recipient.id,
      to: data.email as string,
      subject: `Your Gameweek ${gameweek.roundNumber} results are ready`,
      html: `<p>Gameweek ${gameweek.roundNumber} has been scored.</p><p>View your points and league position on <a href="${env.FRONTEND_URL}/dashboard">Predictions Premier League</a>.</p>`,
      text: `Gameweek ${gameweek.roundNumber} has been scored. View your points at ${env.FRONTEND_URL}/dashboard.`,
    });
    queued += 1;
  }
  return queued;
}

export async function deliverPendingEmails(limit = 50) {
  if (!env.EMAIL_NOTIFICATIONS_ENABLED) return { sent: 0, failed: 0 };
  const [pending, failedSnapshot] = await Promise.all([
    firestore.collection("emailOutbox").where("status", "==", "PENDING").limit(limit).get(),
    firestore.collection("emailOutbox").where("status", "==", "FAILED").limit(limit).get(),
  ]);
  const documents = [...pending.docs, ...failedSnapshot.docs]
    .filter((document) => Number(document.data().attempts ?? 0) < 3)
    .slice(0, limit);
  let sent = 0; let failed = 0;
  for (const document of documents) {
    const data = document.data();
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
  return { sent, failed };
}
