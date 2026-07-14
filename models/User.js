const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  // Basic Info
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },

  // Account Status
  verified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,

  // Roles & Permissions
  role: {
    type: String,
    enum: ["user", "admin", "moderator"],
    default: "user"
  },
  permissions: {
    type: [String],
    default: ["read:tools", "create:content"]
  },

  // Plan & Subscription
  plan: {
    type: String,
    enum: ["free", "pro", "business"],
    default: "free"
  },
  planStartDate: Date,
  planEndDate: Date,

  // Security
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  twoFactorBackupCodes: [String],

  // Session Management
  tokenVersion: {
    type: Number,
    default: 0
  },
  activeSessions: [
    {
      token: String,
      createdAt: Date,
      expiresAt: Date,
      userAgent: String,
      ipAddress: String
    }
  ],

  // Privacy & Preferences
  privacySettings: {
    emailNotifications: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false },
    dataCollection: { type: Boolean, default: true },
    profilePublic: { type: Boolean, default: false }
  },

  // Audit Trail
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastPasswordChange: Date,
  accountDeletedAt: Date
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash if password is new or modified
  if (!this.isModified("password")) {
    return next();
  }

  try {
    // Hash password with salt rounds
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = Date.now();
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (err) {
    throw new Error("Password comparison failed");
  }
};

// Check if account is locked
userSchema.methods.isAccountLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment failed login attempts
userSchema.methods.incLoginAttempts = async function () {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    this.loginAttempts += 1;
    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts >= 5) {
      this.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
  }
  return this.save();
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = Date.now();
  return this.save();
};

// Generate verification token
userSchema.methods.generateVerificationToken = function () {
  const crypto = require("crypto");
  this.verificationToken = crypto.randomBytes(32).toString("hex");
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return this.verificationToken;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const crypto = require("crypto");
  this.passwordResetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return this.passwordResetToken;
};

// Hide sensitive fields in JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.verificationToken;
  delete user.passwordResetToken;
  delete user.twoFactorSecret;
  delete user.twoFactorBackupCodes;
  delete user.activeSessions;
  return user;
};

module.exports = mongoose.model("User", userSchema);
