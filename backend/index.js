import { fileURLToPath } from "url";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "./.env") });
import express from "express";
import cors from "cors";

console.log("DB_ID in index.js=", process.env.FIREBASE_DATABASE_ID);

const { db } = await import("./firestore.js");
import { checkDatabaseConnection } from "./middleware/dbConnection.js";
import fixturesRouter from "./db/fixtures/index.js";
import usersRouter from "./db/users/index.js";
import userPredictionsRouter from "./db/userPredictions/index.js";
import constantsRouter from "./db/constants/index.js";
import scoreRouter from "./db/score/index.js";
import leaguesRouter from "./db/leagues/index.js";
const app = express();

app.use(cors());
app.use(express.json());

// Global database connection check middleware for all API routes
app.use("/api", checkDatabaseConnection);

// simple health route
app.get("/", (req, res) => {
  res.json({ status: "Backend in running", uptime: process.uptime() });
});

// Database health check endpoint
app.get("/health/database", (req, res) => {
  res.json({
    status: "Database connection healthy",
    timestamp: new Date().toISOString(),
    database: "Firestore",
  });
});

// Sample route that reads from a `players` collection (expects documents)
app.get("/api/players", async (req, res) => {
  try {
    const snap = await db.collection("players").limit(50).get();
    const players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ players });
  } catch (err) {
    console.error("Error fetching players:", err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

// mount routes
app.use("/api/fixtures", fixturesRouter);
app.use("/api/users", usersRouter);
app.use("/api/user-predictions", userPredictionsRouter);
app.use("/api/constants", constantsRouter);
app.use("/api/score", scoreRouter);
app.use("/api/leagues", leaguesRouter);

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
