import express from "express";
import { db } from "../firestore.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// Get first document from fixtures collection
router.get("/fixtures", async (req, res) => {
  try {
    const snapshot = await db.collection("fixtures").limit(1).get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        data: null,
        message: "No documents found in fixtures collection",
      });
    }

    const doc = snapshot.docs[0];
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching first fixture:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch first fixture document",
    });
  }
});

// Get first document from users collection
router.get("/users", async (req, res) => {
  try {
    const snapshot = await db.collection("users").limit(1).get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        data: null,
        message: "No documents found in users collection",
      });
    }

    const doc = snapshot.docs[0];
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching first user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch first user document",
    });
  }
});

// Get first document from user_predictions collection
router.get("/user-predictions", async (req, res) => {
  try {
    const snapshot = await db.collection("user_predictions").limit(1).get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        data: null,
        message: "No documents found in user_predictions collection",
      });
    }

    const doc = snapshot.docs[0];
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching first user prediction:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch first user prediction document",
    });
  }
});

// Get first document from leagues collection
router.get("/leagues", async (req, res) => {
  try {
    const snapshot = await db.collection("leagues").limit(1).get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        data: null,
        message: "No documents found in leagues collection",
      });
    }

    const doc = snapshot.docs[0];
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching first league:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch first league document",
    });
  }
});

// Get first document from league_members collection
router.get("/league-members", async (req, res) => {
  try {
    const snapshot = await db.collection("league_members").limit(1).get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        data: null,
        message: "No documents found in league_members collection",
      });
    }

    const doc = snapshot.docs[0];
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching first league member:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch first league member document",
    });
  }
});

// Get first document from league_scores collection
router.get("/league-scores", async (req, res) => {
  try {
    const snapshot = await db.collection("league_scores").limit(1).get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        data: null,
        message: "No documents found in league_scores collection",
      });
    }

    const doc = snapshot.docs[0];
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching first league score:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch first league score document",
    });
  }
});

// Get first document from players collection (if it exists)
router.get("/players", async (req, res) => {
  try {
    const snapshot = await db.collection("players").limit(1).get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        data: null,
        message: "No documents found in players collection",
      });
    }

    const doc = snapshot.docs[0];
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching first player:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch first player document",
    });
  }
});

export default router;
