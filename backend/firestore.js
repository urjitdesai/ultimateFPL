import { fileURLToPath } from "url";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "./.env") });
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './firebase-service-account-key.json' with { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const databaseId = process.env.FIREBASE_DATABASE_ID ;
const db = getFirestore(admin.app(), databaseId);
console.log('Firestore initialized with databaseId:', databaseId);
console.log('db=', db);


export { db, admin };
