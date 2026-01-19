import { db } from "../firestore.js";

/**
 * Middleware to check if the requesting user and the target user are in the same league
 * This ensures users can only view prediction data of users they share a league with
 */
export const verifySharedLeagueMembership = async (req, res, next) => {
  try {
    const requestingUserId = req.user.id; // From auth middleware
    const targetUserId = req.params.userId; // User whose predictions are being requested

    // Log the access attempt for security auditing
    console.log(
      `[SECURITY] Access attempt: User ${requestingUserId} requesting data for user ${targetUserId}`
    );

    // If user is trying to access their own data, allow it
    if (requestingUserId === targetUserId) {
      console.log(
        `[SECURITY] Self-access granted for user ${requestingUserId}`
      );
      return next();
    }

    // Validate that targetUserId is a valid format (basic input validation)
    if (
      !targetUserId ||
      typeof targetUserId !== "string" ||
      targetUserId.length < 1
    ) {
      console.log(`[SECURITY] Invalid target user ID: ${targetUserId}`);
      return res.status(400).json({
        error: "Bad request",
        message: "Invalid user ID format",
      });
    }

    // Get all leagues the requesting user is a member of
    const requestingUserLeaguesSnapshot = await db
      .collection("users_leagues")
      .where("userId", "==", requestingUserId)
      .get();

    if (requestingUserLeaguesSnapshot.empty) {
      console.log(
        `[SECURITY] Access denied: User ${requestingUserId} is not in any leagues`
      );
      return res.status(403).json({
        error: "Access denied",
        message:
          "You must be a member of a league to view other users' predictions",
      });
    }

    // Get all league IDs the requesting user is in
    const requestingUserLeagueIds = requestingUserLeaguesSnapshot.docs.map(
      (doc) => doc.data().leagueId
    );

    // Get all leagues the target user is a member of
    const targetUserLeaguesSnapshot = await db
      .collection("users_leagues")
      .where("userId", "==", targetUserId)
      .get();

    if (targetUserLeaguesSnapshot.empty) {
      console.log(
        `[SECURITY] Target user ${targetUserId} not found or not in any leagues`
      );
      return res.status(404).json({
        error: "User not found",
        message: "The requested user is not a member of any leagues",
      });
    }

    // Get all league IDs the target user is in
    const targetUserLeagueIds = targetUserLeaguesSnapshot.docs.map(
      (doc) => doc.data().leagueId
    );

    // Check if there's any common league between the two users
    const sharedLeagues = requestingUserLeagueIds.filter((leagueId) =>
      targetUserLeagueIds.includes(leagueId)
    );

    if (sharedLeagues.length === 0) {
      console.log(
        `[SECURITY] Access denied: Users ${requestingUserId} and ${targetUserId} share no common leagues. ` +
          `Requester leagues: [${requestingUserLeagueIds.join(", ")}], ` +
          `Target leagues: [${targetUserLeagueIds.join(", ")}]`
      );
      return res.status(403).json({
        error: "Access denied",
        message:
          "You can only view predictions of users who are in the same league as you",
      });
    }

    // Add shared league information to request object for potential use in controller
    req.sharedLeagues = sharedLeagues;

    console.log(
      `[SECURITY] Access granted: User ${requestingUserId} can view predictions of user ${targetUserId}. ` +
        `Shared leagues: [${sharedLeagues.join(", ")}]`
    );

    next();
  } catch (error) {
    console.error("[SECURITY] Error in league membership verification:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to verify league membership",
    });
  }
};

/**
 * Middleware to check if a user can access a specific league
 * This can be used for league-specific endpoints
 */
export const verifyLeagueMembership = (leagueIdParam = "leagueId") => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const leagueId = req.params[leagueIdParam];

      if (!leagueId) {
        return res.status(400).json({
          error: "Bad request",
          message: "League ID is required",
        });
      }

      // Check if user is a member of the specified league
      const membershipSnapshot = await db
        .collection("users_leagues")
        .where("userId", "==", userId)
        .where("leagueId", "==", leagueId)
        .limit(1)
        .get();

      if (membershipSnapshot.empty) {
        return res.status(403).json({
          error: "Access denied",
          message: "You are not a member of this league",
        });
      }

      // Add league membership info to request
      req.leagueMembership = membershipSnapshot.docs[0].data();

      next();
    } catch (error) {
      console.error("Error in league membership verification:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to verify league membership",
      });
    }
  };
};
