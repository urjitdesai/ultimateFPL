import { db } from "../firestore.js";

/**
 * Simple middleware to check database connection
 * Verifies that Firestore is initialized before processing requests
 */
const checkDatabaseConnection = (req, res, next) => {
  console.log("Checking db connection in middleware");

  if (!db) {
    return res.status(500).json({
      error: "Database not initialized",
    });
  }
  next();
};

export { checkDatabaseConnection };
