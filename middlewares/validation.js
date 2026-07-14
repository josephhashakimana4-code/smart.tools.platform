const xss = require("xss");

/**
 * Sanitize input to prevent XSS attacks
 */
function sanitizeInput(input) {
  if (typeof input === "string") {
    return xss(input, {
      whiteList: {},
      stripIgnoredTag: true
    });
  }
  if (typeof input === "object" && input !== null) {
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
  next();
}

/**
 * Validate required fields
 */
function validateRequiredFields(fields) {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      if (!req.body[field]) {
        missing.push(field);
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
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }
  next();
}

/**
 * Validate password strength
 */
function validatePasswordStrength(req, res, next) {
  const password = req.body.password;
  if (!password) {
    return res.status(400).json({
      success: false,
      message: "Password is required"
    });
  }
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters"
    });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      success: false,
      message: "Password must contain uppercase, lowercase, number, and special character (@$!%*?&)"
    });
  }
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
