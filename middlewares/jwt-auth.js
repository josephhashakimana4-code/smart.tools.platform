const jwt = require("jsonwebtoken");
const { logAuthEvent, logSecurityEvent } = require("./audit");

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change_this_access_secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "change_this_refresh_secret";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

/**
 * Generate access token
 */
function generateAccessToken(user) {
  const payload = {
    sub: String(user._id),
    email: user.email,
    role: user.role,
    plan: user.plan,
    verified: user.verified,
    tokenVersion: user.tokenVersion
  };

  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES,
    issuer: "SmartToolsHub",
    audience: "SmartToolsHubUsers"
  });
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    sub: String(user._id),
    type: "refresh",
    tokenVersion: user.tokenVersion
  };

  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
    issuer: "SmartToolsHub"
  });
}

/**
 * Generate both tokens
 */
function generateTokens(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  };
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET, {
      issuer: "SmartToolsHub",
      audience: "SmartToolsHubUsers"
    });
  } catch (err) {
    throw new Error(`Access token verification failed: ${err.message}`);
  }
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_SECRET, {
      issuer: "SmartToolsHub"
    });
  } catch (err) {
    throw new Error(`Refresh token verification failed: ${err.message}`);
  }
}

/**
 * Middleware to verify JWT in Authorization header
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid authorization header"
      });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      next();
    } catch (err) {
      const ipAddress = req.ip || req.connection.remoteAddress;
      logSecurityEvent("invalid_token", "unknown", { error: err.message, ip: ipAddress }, "low");

      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
        code: "TOKEN_EXPIRED"
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authentication error"
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token, just sets req.user
 */
function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
      } catch (err) {
        // Silently fail - user is optional
        req.user = null;
      }
    }

    next();
  } catch (err) {
    next();
  }
}

/**
 * Middleware to verify user role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!roles.includes(req.user.role)) {
      const ipAddress = req.ip || req.connection.remoteAddress;
      logSecurityEvent("unauthorized_access", req.user.sub, { endpoint: req.path, ip: ipAddress }, "medium");

      return res.status(403).json({
        success: false,
        message: "Insufficient permissions"
      });
    }

    next();
  };
}

/**
 * Middleware to verify email is verified
 */
function requireVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  if (!req.user.verified) {
    return res.status(403).json({
      success: false,
      message: "Email verification required"
    });
  }

  next();
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireVerified
};
