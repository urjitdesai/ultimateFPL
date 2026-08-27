import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { Store } from "express-rate-limit";
import { firestore } from "../firebase/admin.js";

export class FirestoreRateLimitStore implements Store {
  localKeys = false;
  prefix: string;
  private windowMs: number;

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  private reference(key: string) {
    const documentId = crypto.createHash("sha256").update(`${this.prefix}:${key}`).digest("hex");
    return firestore.collection("rateLimitCounters").doc(documentId);
  }

  async increment(key: string) {
    const reference = this.reference(key);
    return firestore.runTransaction(async (transaction) => {
      const counter = await transaction.get(reference);
      const now = Timestamp.now();
      const storedResetAt = counter.data()?.resetAt;
      const resetAt = storedResetAt instanceof Timestamp && storedResetAt.toMillis() > now.toMillis()
        ? storedResetAt
        : Timestamp.fromMillis(now.toMillis() + this.windowMs);
      const totalHits = resetAt === storedResetAt
        ? Number(counter.data()?.totalHits ?? 0) + 1
        : 1;

      transaction.set(reference, {
        totalHits,
        resetAt,
        expiresAt: resetAt,
        updatedAt: now,
      });
      return { totalHits, resetTime: resetAt.toDate() };
    });
  }

  async decrement(key: string) {
    const reference = this.reference(key);
    await firestore.runTransaction(async (transaction) => {
      const counter = await transaction.get(reference);
      if (!counter.exists) return;
      const totalHits = Math.max(0, Number(counter.data()!.totalHits ?? 0) - 1);
      transaction.update(reference, { totalHits, updatedAt: Timestamp.now() });
    });
  }

  async resetKey(key: string) {
    await this.reference(key).delete();
  }
}
