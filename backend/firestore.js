import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './firebase-service-account-key.json' with { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const databaseId = process.env.FIREBASE_DATABASE_ID ;
const db = getFirestore(admin.app(), databaseId);
console.log('Database id in firestore= ', databaseId);

export { db, admin };
