import jwt from "jsonwebtoken";

// Helper function to generate JWT token
export const generateToken = (userId, email, displayName) => {
  return jwt.sign(
    {
      userId: userId,
      email: email,
      display_name: displayName,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Helper function to verify JWT token
export const verifyJWT = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Middleware to verify JWT token and attach user to request
export const authenticateToken = (req, res, next) => {
  // Check for token in cookies first (primary method)
  let token = req.cookies && req.cookies.token;

  // If no token in cookies, check authorization header as fallback
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
  }

  if (!token) {
    return res.status(401).json({
      error: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = verifyJWT(token);

    // Attach user info to request object
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      display_name: decoded.display_name,
    };

    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired. Please log in again.",
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token. Please log in again.",
      });
    }

    return res.status(401).json({
      error: "Token verification failed.",
    });
  }
};

// Optional middleware for routes that can work with or without authentication
export const optionalAuth = (req, res, next) => {
  // Check for token in cookies first (primary method)
  let token = req.cookies && req.cookies.token;

  // If no token in cookies, check authorization header as fallback
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    // No token provided, continue without user
    req.user = null;
    return next();
  }

  try {
    const decoded = verifyJWT(token);

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      display_name: decoded.display_name,
    };

    next();
  } catch (err) {
    // Invalid token, but continue without user
    req.user = null;
    next();
  }
};
