import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import serviceAccount from "./firebase-service-account-key.json" with { type: 'json' };;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore(admin.app(), process.env.DATABASE_ID);
export { db, admin };
