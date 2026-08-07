import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../config/env.js";

const localCredential = path.resolve(process.cwd(), "firebase-service-account-key.json");

function credential() {
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") });
  }
  const credentialPath = env.FIREBASE_SERVICE_ACCOUNT_PATH ? path.resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH) : localCredential;
  if (existsSync(credentialPath)) return cert(JSON.parse(readFileSync(credentialPath, "utf8")));
  return applicationDefault();
}

const app = getApps()[0] ?? initializeApp({ credential: credential(), projectId: env.FIREBASE_PROJECT_ID });
export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app, env.FIREBASE_DATABASE_ID);
