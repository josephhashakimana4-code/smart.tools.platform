const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const {
  generateTokens,
  authMiddleware,
  requireVerified,
  verifyRefreshToken
} = require("../middlewares/jwt-auth");
const {
  sanitizeInput,
  isValidEmail,
  isStrongPassword,
  validateRequiredFields,
  validateEmail,
  validatePasswordStrength
} = require("../middlewares/validation");
const { logAuthEvent, logSecurityEvent } = require("../middlewares/audit");
const { generateCsrfToken } = require("../middlewares/csrf");

const router = express.Router();

/**
 * POST /api/auth/csrf-token
 * Get CSRF token for client
 */
router.get("/csrf-token", (req, res) => {
  try {
    const token = generateCsrfToken();
    res.json({
      success: true,
      csrfToken: token
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to generate CSRF token"
    });
  }
});

/**
 * POST /api/auth/register
 * Register new user
 */
router.post(
  "/register",
  validateRequiredFields(["email", "password", "firstName"]),
  validateEmail,
  validatePasswordStrength,
  async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Check if user already exists
      let user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        logAuthEvent("registration_failed", null, email, ipAddress, req.get("user-agent"), false, "Email already registered");
        return res.status(409).json({
          success: false,
          message: "Email already registered"
        });
      }

      // Create new user
      user = new User({
        email: email.toLowerCase(),
        password,
        firstName: sanitizeInput(firstName),
        lastName: sanitizeInput(lastName || ""),
        verificationToken: null
      });

      // Generate verification token
      const verificationToken = user.generateVerificationToken();

      await user.save();

      logAuthEvent("registration_success", user._id, email, ipAddress, req.get("user-agent"), true);

      // TODO: Send verification email with verificationToken
      // await sendVerificationEmail(email, verificationToken);

      res.status(201).json({
        success: true,
        message: "Registration successful. Please verify your email.",
        userId: user._id,
        email: user.email
      });
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({
        success: false,
        message: "Registration failed"
      });
    }
  }
);

/**
 * POST /api/auth/login
 * User login
 */
router.post(
  "/login",
  validateRequiredFields(["email", "password"]),
  validateEmail,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("user-agent");

      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        logAuthEvent("login_failed", null, email, ipAddress, userAgent, false, "User not found");
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }

      // Check if account is locked
      if (user.isAccountLocked()) {
        logSecurityEvent("login_blocked", user._id, { reason: "Account locked", ip: ipAddress }, "medium");
        return res.status(429).json({
          success: false,
          message: "Account temporarily locked due to too many failed login attempts. Try again later."
        });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);

      if (!isMatch) {
        // Increment login attempts
        await user.incLoginAttempts();
        logAuthEvent("login_failed", user._id, email, ipAddress, userAgent, false, "Wrong password");

        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }

      // Check if email is verified
      if (!user.verified) {
        logAuthEvent("login_failed", user._id, email, ipAddress, userAgent, false, "Email not verified");
        return res.status(403).json({
          success: false,
          message: "Please verify your email before logging in",
          code: "EMAIL_NOT_VERIFIED"
        });
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Generate tokens
      const tokens = generateTokens(user);

      // Store active session
      user.activeSessions.push({
        token: tokens.accessToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        userAgent,
        ipAddress
      });

      // Limit active sessions to 5
      if (user.activeSessions.length > 5) {
        user.activeSessions.shift();
      }

      await user.save();

      logAuthEvent("login_success", user._id, email, ipAddress, userAgent, true);

      res.json({
        success: true,
        message: "Login successful",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user.toJSON()
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({
        success: false,
        message: "Login failed"
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post("/refresh", validateRequiredFields(["refreshToken"]), async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findById(decoded.sub);

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      logSecurityEvent("token_refresh_failed", decoded.sub, { reason: "Invalid token version" }, "low");
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token"
      });
    }

    // Generate new tokens
    const newTokens = generateTokens(user);

    res.json({
      success: true,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken
    });
  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token"
    });
  }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post("/logout", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);

    if (user) {
      // Remove current session
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(" ")[1];
        user.activeSessions = user.activeSessions.filter((s) => s.token !== token);
        await user.save();
      }

      logAuthEvent("logout", user._id, user.email, req.ip, req.get("user-agent"), true);
    }

    res.json({
      success: true,
      message: "Logout successful"
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({
      success: false,
      message: "Logout failed"
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post("/verify-email", validateRequiredFields(["verificationToken"]), async (req, res) => {
  try {
    const { verificationToken } = req.body;

    const user = await User.findOne({
      verificationToken,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token"
      });
    }

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    logAuthEvent("email_verified", user._id, user.email, req.ip, req.get("user-agent"), true);

    res.json({
      success: true,
      message: "Email verified successfully"
    });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({
      success: false,
      message: "Email verification failed"
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post("/forgot-password", validateEmail, async (req, res) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      logSecurityEvent("password_reset_requested", null, { email, ip: ipAddress }, "low");
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: "If email exists, password reset link has been sent"
      });
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    logAuthEvent("password_reset_requested", user._id, email, ipAddress, req.get("user-agent"), true);

    // TODO: Send reset email with resetToken
    // await sendPasswordResetEmail(email, resetToken);

    res.json({
      success: true,
      message: "Password reset email sent",
      resetToken // For testing only - remove in production
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      success: false,
      message: "Password reset request failed"
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post("/reset-password", validateRequiredFields(["resetToken", "newPassword"]), validatePasswordStrength, async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const user = await User.findOne({
      passwordResetToken: resetToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      logSecurityEvent("password_reset_failed", null, { reason: "Invalid token", ip: ipAddress }, "low");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();

    logAuthEvent("password_reset_success", user._id, user.email, ipAddress, req.get("user-agent"), true);

    res.json({
      success: true,
      message: "Password reset successful. Please login with your new password."
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      success: false,
      message: "Password reset failed"
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (authenticated users)
 */
router.post("/change-password", authMiddleware, validatePasswordStrength, async (req, res) => {
  try {
    const { password: currentPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const user = await User.findById(req.user.sub);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      logSecurityEvent("password_change_failed", user._id, { reason: "Wrong current password", ip: ipAddress }, "medium");
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Invalidate all sessions
    user.tokenVersion += 1;
    user.activeSessions = [];
    await user.save();

    logAuthEvent("password_changed", user._id, user.email, ipAddress, req.get("user-agent"), true);

    res.json({
      success: true,
      message: "Password changed successfully. Please login again.",
      code: "REAUTH_REQUIRED"
    });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({
      success: false,
      message: "Password change failed"
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user: user.toJSON()
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get user profile"
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, privacySettings } = req.body;
    const user = await User.findById(req.user.sub);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Update fields
    if (firstName) user.firstName = sanitizeInput(firstName);
    if (lastName) user.lastName = sanitizeInput(lastName);
    if (privacySettings) {
      user.privacySettings = {
        ...user.privacySettings,
        ...privacySettings
      };
    }

    user.updatedAt = Date.now();
    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user.toJSON()
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({
      success: false,
      message: "Profile update failed"
    });
  }
});

/**
 * DELETE /api/auth/account
 * Delete account (with password confirmation)
 */
router.delete("/account", authMiddleware, validateRequiredFields(["password"]), async (req, res) => {
  try {
    const { password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const user = await User.findById(req.user.sub);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      logSecurityEvent("account_deletion_failed", user._id, { reason: "Wrong password", ip: ipAddress }, "medium");
      return res.status(401).json({
        success: false,
        message: "Password is incorrect"
      });
    }

    // Soft delete account
    user.accountDeletedAt = Date.now();
    await user.save();

    logAuthEvent("account_deleted", user._id, user.email, ipAddress, req.get("user-agent"), true);

    res.json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (err) {
    console.error("Account deletion error:", err);
    res.status(500).json({
      success: false,
      message: "Account deletion failed"
    });
  }
});

module.exports = router;
