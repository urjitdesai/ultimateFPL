const express = require("express");
const cors = require("cors");
const path = require("path");
// If .env is in repo root (one level up from backend), load it explicitly:
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { db } = require("./firestore");

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
const fixturesRouter = require("./db/fixtures");
app.use("/api/fixtures", fixturesRouter);

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

module.exports = app;
