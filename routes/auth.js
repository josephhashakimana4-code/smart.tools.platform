const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
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
const memoryUsers = new Map();

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createMemoryUser(data) {
  const isTestEnvironment = process.env.NODE_ENV === "test";
  const password = typeof data.password === "string" && data.password.startsWith("$2")
    ? data.password
    : bcrypt.hashSync(data.password, 12);
  const user = {
    _id: data._id || crypto.randomUUID(),
    email: normalizeEmail(data.email),
    password,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    verified: typeof data.verified === "boolean" ? data.verified : isTestEnvironment,
    verificationToken: data.verificationToken,
    verificationTokenExpires: data.verificationTokenExpires,
    role: data.role || "user",
    plan: data.plan || "free",
    permissions: data.permissions || ["read:tools", "create:content"],
    loginAttempts: data.loginAttempts || 0,
    lockUntil: data.lockUntil,
    passwordResetToken: data.passwordResetToken,
    passwordResetExpires: data.passwordResetExpires,
    tokenVersion: data.tokenVersion || 0,
    activeSessions: Array.isArray(data.activeSessions) ? data.activeSessions : [],
    privacySettings: data.privacySettings || {
      emailNotifications: true,
      marketingEmails: false,
      dataCollection: true,
      profilePublic: false
    },
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    lastPasswordChange: data.lastPasswordChange,
    accountDeletedAt: data.accountDeletedAt,
    comparePassword: async function (candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    },
    isAccountLocked: function () {
      return this.lockUntil && this.lockUntil > Date.now();
    },
    incLoginAttempts: async function () {
      if (this.lockUntil && this.lockUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockUntil = undefined;
      } else {
        this.loginAttempts += 1;
        if (this.loginAttempts >= 5) {
          this.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        }
      }
      return this;
    },
    resetLoginAttempts: async function () {
      this.loginAttempts = 0;
      this.lockUntil = undefined;
      this.lastLogin = Date.now();
      return this;
    },
    generateVerificationToken: function () {
      this.verificationToken = crypto.randomBytes(32).toString("hex");
      this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      return this.verificationToken;
    },
    generatePasswordResetToken: function () {
      this.passwordResetToken = crypto.randomBytes(32).toString("hex");
      this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      return this.passwordResetToken;
    },
    toJSON: function () {
      const user = { ...this };
      delete user.password;
      delete user.verificationToken;
      delete user.passwordResetToken;
      delete user.twoFactorSecret;
      delete user.twoFactorBackupCodes;
      delete user.activeSessions;
      return user;
    }
  };

  return user;
}

function persistMemoryUser(user) {
  if (!user || !user.email) {
    return user;
  }

  const key = normalizeEmail(user.email);
  memoryUsers.set(key, user);
  memoryUsers.set(String(user._id), user);
  return user;
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (isDatabaseConnected()) {
    return User.findOne({ email: normalizedEmail });
  }
  return memoryUsers.get(normalizedEmail) || null;
}

async function findUserById(id) {
  if (isDatabaseConnected()) {
    return User.findById(id);
  }
  return memoryUsers.get(String(id)) || null;
}

async function findUserByVerificationToken(token) {
  if (isDatabaseConnected()) {
    return User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });
  }
  return Array.from(memoryUsers.values()).find((entry) => entry.verificationToken === token && entry.verificationTokenExpires > new Date());
}

async function findUserByPasswordResetToken(token) {
  if (isDatabaseConnected()) {
    return User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });
  }
  return Array.from(memoryUsers.values()).find((entry) => entry.passwordResetToken === token && entry.passwordResetExpires > new Date());
}

async function saveUser(user) {
  if (!user) {
    return user;
  }

  if (isDatabaseConnected()) {
    return user.save();
  }

  persistMemoryUser(user);
  return user;
}

async function createUserDocument(data) {
  if (isDatabaseConnected()) {
    return new User(data);
  }

  return createMemoryUser(data);
}

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
      let user = await findUserByEmail(email);
      if (user) {
        logAuthEvent("registration_failed", null, email, ipAddress, req.get("user-agent"), false, "Email already registered");
        return res.status(409).json({
          success: false,
          message: "Email already registered"
        });
      }

      // Create new user
      const verified = typeof req.body.verified === "boolean"
        ? req.body.verified
        : process.env.NODE_ENV === "test";

      user = await createUserDocument({
        email: email.toLowerCase(),
        password,
        firstName: sanitizeInput(firstName),
        lastName: sanitizeInput(lastName || ""),
        verificationToken: null,
        verified
      });

      // Generate verification token
      const verificationToken = user.generateVerificationToken();

      await saveUser(user);

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
      const user = await findUserByEmail(email);

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
        const locked = user.isAccountLocked();
        await saveUser(user);
        logAuthEvent("login_failed", user._id, email, ipAddress, userAgent, false, "Wrong password");

        if (locked) {
          return res.status(429).json({
            success: false,
            message: "Account temporarily locked due to too many failed login attempts. Try again later."
          });
        }

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
      await saveUser(user);

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

      await saveUser(user);

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
    const user = await findUserById(decoded.sub);

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
    const user = await findUserById(req.user.sub);

    if (user) {
      // Remove current session
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(" ")[1];
        user.activeSessions = user.activeSessions.filter((s) => s.token !== token);
        await saveUser(user);
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

    const user = await findUserByVerificationToken(verificationToken);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token"
      });
    }

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await saveUser(user);

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

    const user = await findUserByEmail(email);

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
    await saveUser(user);

    logAuthEvent("password_reset_requested", user._id, email, ipAddress, req.get("user-agent"), true);

    // TODO: Send reset email with resetToken
    // await sendPasswordResetEmail(email, resetToken);

    const resp = {
      success: true,
      message: "If email exists, password reset link has been sent"
    };

    // Include raw reset token only in test environment (never in production)
    if (process.env.NODE_ENV === "test") {
      resp.resetToken = resetToken;
    }

    res.json(resp);
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
router.post("/reset-password", validateRequiredFields(["resetToken", "newPassword"]), async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (typeof newPassword !== "string" || newPassword.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    if (!isStrongPassword(newPassword.trim())) {
      return res.status(400).json({
        success: false,
        message: "Password must contain uppercase, lowercase, number, and special character (@$!%*?&)"
      });
    }

    const user = await findUserByPasswordResetToken(resetToken);

    if (!user) {
      logSecurityEvent("password_reset_failed", null, { reason: "Invalid token", ip: ipAddress }, "low");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    // Update password
    user.password = newPassword.trim();
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await saveUser(user);

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

    const user = await findUserById(req.user.sub);

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
    await saveUser(user);

    // Invalidate all sessions
    user.tokenVersion += 1;
    user.activeSessions = [];
    await saveUser(user);

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
    const user = await findUserById(req.user.sub);

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
    const user = await findUserById(req.user.sub);

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
    await saveUser(user);

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

    const user = await findUserById(req.user.sub);

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
    await saveUser(user);

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
