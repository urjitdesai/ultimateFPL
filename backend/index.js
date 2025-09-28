import dotenv from "dotenv";
import express from "express";
import cors from "cors";
console.log("FIRST");
import path from "path";
import { fileURLToPath } from "url";

// Load .env from repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "./.env") });
console.log("DB ID in index.js= ", process.env.FIREBASE_DATABASE_ID);

import { db } from "./firestore.js";

const app = express();

app.use(cors());
app.use(express.json());

// simple health route
app.get("/", (req, res) => {
  res.json({ status: "Backend in running", uptime: process.uptime() });
});

// Sample route that reads from a `players` collection (expects documents)
app.get("/api/players", async (req, res) => {
  if (!db) return res.status(500).json({ error: "Firestore not initialized" });
  try {
    const snap = await db.collection("players").limit(50).get();
    const players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ players });
  } catch (err) {
    console.error("Error fetching players:", err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

// mount fixtures router
import fixturesRouter from "./db/fixtures.js";
app.use("/api/fixtures", fixturesRouter);

// mount users router
import usersRouter from "./db/users.js";
app.use("/api/users", usersRouter);

// mount userPredictions router
import userPredictionsRouter from "./db/userPredictions.js";
app.use("/api/userPredictions", userPredictionsRouter);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log("Shutting down server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
