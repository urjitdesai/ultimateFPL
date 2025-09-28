const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
var serviceAccount = require("./firebase-service-account-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = getFirestore(admin.app(), process.env.DATABASE_ID);
module.exports = { db };
