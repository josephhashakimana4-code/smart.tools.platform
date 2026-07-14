const crypto = require("crypto");

/**
 * Simple CSRF protection middleware
 * Generates tokens for state-changing requests
 */

const csrfTokens = new Map();

// Clean expired tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.createdAt > maxAge) {
      csrfTokens.delete(token);
    }
  }
}, 30 * 60 * 1000);

/**
 * Generate CSRF token
 */
function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(token, {
    createdAt: Date.now()
  });
  return token;
}

/**
 * Verify CSRF token
 */
function verifyCsrfToken(token) {
  if (!token || !csrfTokens.has(token)) {
    return false;
  }
  return true;
}

/**
 * Consume CSRF token (one-time use)
 */
function consumeCsrfToken(token) {
  if (csrfTokens.has(token)) {
    csrfTokens.delete(token);
    return true;
  }
  return false;
}

/**
 * CSRF middleware - verify on POST, PUT, DELETE, PATCH
 */
function csrfProtection(req, res, next) {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF check for public endpoints
  const publicEndpoints = ["/api/auth/register", "/api/auth/login", "/api/tools", "/api/blog"];
  if (publicEndpoints.some((endpoint) => req.path.startsWith(endpoint))) {
    return next();
  }

  const token = req.headers["x-csrf-token"] || req.body?.csrfToken;

  if (!token) {
    return res.status(403).json({
      success: false,
      message: "CSRF token missing"
    });
  }

  if (!verifyCsrfToken(token)) {
    return res.status(403).json({
      success: false,
      message: "Invalid CSRF token"
    });
  }

  // Consume the token
  consumeCsrfToken(token);
  next();
}

/**
 * Middleware to generate CSRF token for GET requests
 * Attach token to response locals
 */
function generateCsrfTokenMiddleware(req, res, next) {
  if (req.method === "GET") {
    const token = generateCsrfToken();
    res.locals.csrfToken = token;
    res.set("X-CSRF-Token", token);
  }
  next();
}

module.exports = {
  generateCsrfToken,
  verifyCsrfToken,
  consumeCsrfToken,
  csrfProtection,
  generateCsrfTokenMiddleware
};
