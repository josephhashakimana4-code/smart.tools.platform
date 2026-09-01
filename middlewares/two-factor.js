const crypto = require("crypto");
const User = require("../models/User");

/**
 * Two-Factor Authentication (2FA) / Second Verification Middleware
 * Supports OTP (One-Time Passcode) via email or TOTP
 */

const verificationStore = new Map();
const MAX_ATTEMPTS = 3;
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
const VERIFICATION_EXPIRY = 15 * 60 * 1000; // 15 minutes

/**
 * Generate OTP (6-digit code)
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate verification session
 */
function generateVerificationSession(userId, type = "otp", metadata = {}) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const otp = type === "otp" ? generateOTP() : null;
  
  const session = {
    sessionId,
    userId,
    type, // 'otp', 'email', 'backup-code'
    otp,
    otpCreatedAt: Date.now(),
    otpExpires: Date.now() + OTP_EXPIRY,
    sessionCreatedAt: Date.now(),
    sessionExpires: Date.now() + VERIFICATION_EXPIRY,
    attempts: 0,
    verified: false,
    metadata,
    createdAt: Date.now(),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent
  };

  verificationStore.set(sessionId, session);
  return { sessionId, otp, expires: session.otpExpires };
}

/**
 * Verify OTP
 */
function verifyOTP(sessionId, otp) {
  if (!sessionId || !verificationStore.has(sessionId)) {
    return {
      success: false,
      message: "Verification session not found or expired"
    };
  }

  const session = verificationStore.get(sessionId);

  // Check if session is expired
  if (Date.now() > session.sessionExpires) {
    verificationStore.delete(sessionId);
    return {
      success: false,
      message: "Verification session expired"
    };
  }

  // Check attempt limit
  if (session.attempts >= MAX_ATTEMPTS) {
    verificationStore.delete(sessionId);
    return {
      success: false,
      message: "Maximum verification attempts exceeded. Please request a new code."
    };
  }

  // Check if OTP is expired
  if (Date.now() > session.otpExpires) {
    return {
      success: false,
      message: "OTP expired. Please request a new code."
    };
  }

  // Verify OTP
  if (session.otp && session.otp === otp.toString()) {
    session.verified = true;
    session.verifiedAt = Date.now();
    return {
      success: true,
      sessionId,
      message: "Verification successful"
    };
  }

  session.attempts++;
  return {
    success: false,
    message: "Invalid OTP",
    attemptsRemaining: MAX_ATTEMPTS - session.attempts
  };
}

/**
 * Get verification session
 */
function getVerificationSession(sessionId) {
  if (!verificationStore.has(sessionId)) {
    return null;
  }

  const session = verificationStore.get(sessionId);

  if (Date.now() > session.sessionExpires) {
    verificationStore.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Complete verification (consume session)
 */
function completeVerification(sessionId) {
  if (!verificationStore.has(sessionId)) {
    return false;
  }

  const session = verificationStore.get(sessionId);

  if (!session.verified || Date.now() > session.sessionExpires) {
    verificationStore.delete(sessionId);
    return false;
  }

  verificationStore.delete(sessionId);
  return true;
}

/**
 * Middleware: Require second verification for sensitive operations
 * Usage: app.use(requireSecondVerification({ 
 *   operations: ['admin:delete', 'user:profile:email:change'],
 *   exceptions: []
 * }))
 */
function requireSecondVerification(config = {}) {
  const {
    operations = [],
    exceptions = [],
    skipForRoles = ["guest", "public"]
  } = config;

  return async (req, res, next) => {
    // Skip for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Skip exceptions
    if (exceptions.some(ex => req.path.includes(ex))) {
      return next();
    }

    // Skip for unauthenticated users
    if (!req.user || skipForRoles.includes(req.user.role)) {
      return next();
    }

    // Check if this is a sensitive operation
    const operation = req.body?.operation || req.headers["x-operation"];
    const isSensitive = !operations.length || operations.includes(operation);

    if (!isSensitive) {
      return next();
    }

    // Check for second verification session
    const verificationSessionId = req.headers["x-verification-session"] || req.body?.verificationSessionId;

    if (!verificationSessionId) {
      return res.status(403).json({
        success: false,
        message: "Second verification required for this operation",
        code: "VERIFICATION_REQUIRED",
        requiresVerification: true
      });
    }

    const session = getVerificationSession(verificationSessionId);

    if (!session) {
      return res.status(403).json({
        success: false,
        message: "Verification session expired or invalid",
        code: "VERIFICATION_EXPIRED",
        requiresVerification: true
      });
    }

    if (!session.verified) {
      return res.status(403).json({
        success: false,
        message: "Verification pending. Please verify your OTP.",
        code: "VERIFICATION_PENDING",
        requiresVerification: true
      });
    }

    if (session.userId !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Verification session does not match current user",
        code: "VERIFICATION_MISMATCH"
      });
    }

    // Attach verification to request
    req.verification = {
      sessionId: verificationSessionId,
      type: session.type,
      metadata: session.metadata
    };

    // Complete verification after successful request
    res.once("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        completeVerification(verificationSessionId);
      }
    });

    next();
  };
}

/**
 * Clean up expired sessions periodically
 */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of verificationStore.entries()) {
    if (now > session.sessionExpires) {
      verificationStore.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

module.exports = {
  generateVerificationSession,
  verifyOTP,
  getVerificationSession,
  completeVerification,
  requireSecondVerification,
  OTP_EXPIRY,
  VERIFICATION_EXPIRY,
  MAX_ATTEMPTS
};
