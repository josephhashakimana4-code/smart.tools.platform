const xss = require("xss");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Sanitize input to prevent XSS attacks
 */
function sanitizeInput(input) {
  if (typeof input === "string") {
    return xss(input, {
      whiteList: {},
      stripIgnoredTag: true
    }).trim();
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item));
  }
  if (isObject(input)) {
    const sanitized = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password strength
 * Requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
function isStrongPassword(password) {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongRegex.test(password);
}

/**
 * Validate username format
 */
function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate URL
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware to sanitize request body
 */
function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeInput(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeInput(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeInput(req.params);
  }
  next();
}

/**
 * Validate required fields
 */
function validateRequiredFields(fields) {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      const value = req.body?.[field];
      const isBlank = typeof value !== "string"
        ? value === undefined || value === null || value === ""
        : value.trim() === "";

      if (isBlank) {
        missing.push(field);
      } else if (typeof value === "string") {
        req.body[field] = value.trim();
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        fields: missing
      });
    }
    next();
  };
}

/**
 * Validate email in request
 */
function validateEmail(req, res, next) {
  const email = req.body.email;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email;

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  req.body.email = normalizedEmail;
  next();
}

/**
 * Validate password strength
 */
function validatePasswordStrength(req, res, next) {
  const password = req.body.password;
  if (typeof password !== "string" || password.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Password is required"
    });
  }

  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters"
    });
  }
  if (!isStrongPassword(trimmedPassword)) {
    return res.status(400).json({
      success: false,
      message: "Password must contain uppercase, lowercase, number, and special character (@$!%*?&)"
    });
  }

  req.body.password = trimmedPassword;
  next();
}

/**
 * Limit request body size
 */
function limitBodySize(maxSize = "1mb") {
  return (req, res, next) => {
    const limit = require("bytes").parse(maxSize);
    const length = parseInt(req.headers["content-length"]);
    if (length > limit) {
      return res.status(413).json({
        success: false,
        message: "Request payload too large"
      });
    }
    next();
  };
}

module.exports = {
  sanitizeInput,
  isValidEmail,
  isStrongPassword,
  isValidUsername,
  isValidUrl,
  sanitizeMiddleware,
  validateRequiredFields,
  validateEmail,
  validatePasswordStrength,
  limitBodySize
};
