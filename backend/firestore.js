import { fileURLToPath } from "url";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "./.env") });
import { existsSync, readFileSync } from "node:fs";
import admin from "firebase-admin";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const localCredentialPath = path.resolve(
  __dirname,
  "firebase-service-account-key.json",
);
const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : localCredentialPath;

const createCredential = () => {
  if (!existsSync(credentialPath)) {
    return admin.credential.applicationDefault();
  }

  const serviceAccount = JSON.parse(readFileSync(credentialPath, "utf8"));
  return admin.credential.cert(serviceAccount);
};

const app = getApps()[0] || initializeApp({ credential: createCredential() });
const databaseId = process.env.FIREBASE_DATABASE_ID;
const db = getFirestore(app, databaseId);

export { db, admin };
