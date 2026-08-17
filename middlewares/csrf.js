const crypto = require("crypto");

/**
 * Simple CSRF protection middleware
 * Generates tokens for state-changing requests
 */

const csrfTokens = new Map();

// Clean expired tokens every 30 minutes
const csrfCleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.createdAt > maxAge) {
      csrfTokens.delete(token);
    }
  }
}, 30 * 60 * 1000);
if (csrfCleanupInterval.unref) {
  csrfCleanupInterval.unref();
}

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

  const tokenData = csrfTokens.get(token);
  const maxAge = 60 * 60 * 1000;

  if (!tokenData || Date.now() - tokenData.createdAt > maxAge) {
    csrfTokens.delete(token);
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

  const publicEndpoints = ["/api/auth/csrf-token", "/api/business/webhooks/stripe", "/health", "/api/health"];
  if (publicEndpoints.some((endpoint) => req.path.startsWith(endpoint))) {
    return next();
  }

  const token = req.headers["x-csrf-token"] || req.headers["X-CSRF-Token"] || req.body?.csrfToken;

  if (!token) {
    return res.status(403).json({
      success: false,
      message: "CSRF token missing"
    });
  }

  if (!verifyCsrfToken(token)) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired CSRF token"
    });
  }

  // Do not consume the token before the request is processed.
  // Validation/authentication failures should not invalidate the CSRF token.
  // Consume it only after a successful state-changing request.
  res.once("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      consumeCsrfToken(token);
    }
  });

  next();
}

/**
 * Middleware to generate CSRF token for GET requests
 * Attach token to response locals
 */
function generateCsrfTokenMiddleware(req, res, next) {
  next();
}

module.exports = {
  generateCsrfToken,
  verifyCsrfToken,
  consumeCsrfToken,
  csrfProtection,
  generateCsrfTokenMiddleware
};
