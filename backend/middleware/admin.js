const getAdminUserIds = () =>
  new Set(
    (process.env.ADMIN_USER_IDS || "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );

/**
 * Restricts operational endpoints to server-configured administrators.
 * ADMIN_USER_IDS is a comma-separated list of Firestore user document IDs.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user?.id || !getAdminUserIds().has(req.user.id)) {
    return res.status(403).json({
      success: false,
      error: "Administrator access required.",
    });
  }

  return next();
};
