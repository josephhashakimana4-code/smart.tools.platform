/**
 * Second Verification Routes
 * Handles OTP generation, verification, and session management for sensitive operations
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/jwt-auth");
const {
  generateVerificationSession,
  verifyOTP,
  getVerificationSession,
  completeVerification
} = require("../middlewares/two-factor");
const { logSecurityEvent } = require("../middlewares/audit");

/**
 * POST /api/auth/verification/initiate
 * Initiate second verification (send OTP via email or SMS)
 */
router.post("/initiate", authMiddleware, async (req, res) => {
  try {
    const { operation, type = "otp" } = req.body;
    
    if (!operation) {
      return res.status(400).json({
        success: false,
        message: "Operation type is required"
      });
    }

    // Validate operation type
    const allowedOperations = [
      "email-change",
      "password-change",
      "account-delete",
      "admin:user-delete",
      "admin:settings-change",
      "payment-sensitive"
    ];

    if (!allowedOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operation type"
      });
    }

    const metadata = {
      operation,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      timestamp: new Date()
    };

    const session = generateVerificationSession(
      String(req.user._id),
      type,
      metadata
    );

    // TODO: Send OTP via email (implement email service integration)
    // await sendVerificationEmail(req.user.email, session.otp, operation);

    // Log security event
    await logSecurityEvent(req.user._id, "verification_initiated", {
      operation,
      type,
      sessionId: session.sessionId,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: "Verification code sent to your email",
      sessionId: session.sessionId,
      expires: session.expires,
      type: "otp",
      // In development, include OTP for testing
      ...(process.env.NODE_ENV !== "production" && {
        _testOtp: session.otp
      })
    });
  } catch (error) {
    console.error("Verification initiation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate verification",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});

/**
 * POST /api/auth/verification/verify
 * Verify OTP and get verification session
 */
router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const { sessionId, otp } = req.body;

    if (!sessionId || !otp) {
      return res.status(400).json({
        success: false,
        message: "Session ID and OTP are required"
      });
    }

    // Verify OTP
    const result = verifyOTP(sessionId, otp);

    if (!result.success) {
      // Log failed verification attempt
      await logSecurityEvent(req.user._id, "verification_failed", {
        sessionId,
        reason: result.message,
        ipAddress: req.ip,
        attemptsRemaining: result.attemptsRemaining
      });

      return res.status(403).json({
        success: false,
        message: result.message,
        attemptsRemaining: result.attemptsRemaining
      });
    }

    // Log successful verification
    await logSecurityEvent(req.user._id, "verification_success", {
      sessionId,
      ipAddress: req.ip
    });

    const session = getVerificationSession(sessionId);

    res.status(200).json({
      success: true,
      message: "Verification successful",
      sessionId: result.sessionId,
      verified: true,
      operation: session.metadata.operation,
      expiresIn: session.sessionExpires - Date.now()
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});

/**
 * GET /api/auth/verification/status/:sessionId
 * Check verification session status
 */
router.get("/status/:sessionId", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = getVerificationSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Verification session not found or expired"
      });
    }

    // Only the user who initiated the session can check its status
    if (session.userId !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    res.status(200).json({
      success: true,
      sessionId,
      verified: session.verified,
      operation: session.metadata.operation,
      attempts: session.attempts,
      maxAttempts: 3,
      expiresIn: Math.max(0, session.sessionExpires - Date.now()),
      type: session.type
    });
  } catch (error) {
    console.error("Verification status check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check verification status"
    });
  }
});

/**
 * POST /api/auth/verification/resend
 * Resend OTP
 */
router.post("/resend", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = getVerificationSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Verification session not found or expired"
      });
    }

    if (session.userId !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Check if trying to resend too quickly (must wait at least 30 seconds)
    if (session.otpCreatedAt && Date.now() - session.otpCreatedAt < 30 * 1000) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting a new code",
        retryAfter: 30
      });
    }

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    session.otp = newOtp;
    session.otpCreatedAt = Date.now();
    session.otpExpires = Date.now() + 5 * 60 * 1000;
    session.attempts = 0;

    // TODO: Send new OTP via email
    // await sendVerificationEmail(req.user.email, newOtp, session.metadata.operation);

    await logSecurityEvent(req.user._id, "verification_resend", {
      sessionId,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: "New verification code sent",
      expires: session.otpExpires,
      // In development, include OTP for testing
      ...(process.env.NODE_ENV !== "production" && {
        _testOtp: newOtp
      })
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification code"
    });
  }
});

/**
 * POST /api/auth/verification/cancel
 * Cancel verification session
 */
router.post("/cancel", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = getVerificationSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Verification session not found"
      });
    }

    if (session.userId !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    completeVerification(sessionId);

    await logSecurityEvent(req.user._id, "verification_cancelled", {
      sessionId,
      operation: session.metadata.operation,
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: "Verification cancelled"
    });
  } catch (error) {
    console.error("Cancel verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel verification"
    });
  }
});

module.exports = router;
