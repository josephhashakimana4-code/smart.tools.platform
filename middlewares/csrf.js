/**
 * Global CSRF Protection
 * One centralized implementation for all state-changing requests.
 */

const crypto = require("crypto");

const csrfTokens = new Map();

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const EXEMPT_PATHS = new Set([
  "/api/auth/csrf-token",
  "/api/business/webhooks/stripe",
  "/health",
  "/api/health"
]);

const TOKEN_MAX_AGE = 60 * 60 * 1000; // 1 hour

function cleanupExpiredTokens() {
  const now = Date.now();

  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.createdAt > TOKEN_MAX_AGE) {
      csrfTokens.delete(token);
    }
  }
}

const cleanupInterval = setInterval(cleanupExpiredTokens, 30 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Generate a CSRF token.
 */
function generateCsrfToken(userId = null) {
  cleanupExpiredTokens();

  const token = crypto.randomBytes(32).toString("hex");

  csrfTokens.set(token, {
    createdAt: Date.now(),
    userId: userId ? String(userId) : null
  });

  return token;
}

/**
 * Verify token validity and optional user binding.
 */
function verifyCsrfToken(token, userId = null) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const tokenData = csrfTokens.get(token);

  if (!tokenData) {
    return false;
  }

  if (Date.now() - tokenData.createdAt > TOKEN_MAX_AGE) {
    csrfTokens.delete(token);
    return false;
  }

  if (
    tokenData.userId &&
    userId &&
    tokenData.userId !== String(userId)
  ) {
    return false;
  }

  return true;
}

/**
 * Remove token manually when required.
 */
function consumeCsrfToken(token) {
  return csrfTokens.delete(token);
}

/**
 * Determine whether endpoint is exempt.
 */
function isEndpointExempt(path) {
  return EXEMPT_PATHS.has(path);
}

/**
 * Global CSRF middleware.
 *
 * Protects:
 * POST
 * PUT
 * PATCH
 * DELETE
 *
 * Allows:
 * GET
 * HEAD
 * OPTIONS
 */
function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (isEndpointExempt(req.path)) {
    return next();
  }

  const token =
    req.get("X-CSRF-Token") ||
    req.body?.csrfToken ||
    req.query?.csrfToken;

  if (!token) {
    return res.status(403).json({
      success: false,
      message: "CSRF token missing",
      code: "CSRF_MISSING"
    });
  }

  if (!verifyCsrfToken(token)) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired CSRF token",
      code: "CSRF_INVALID"
    });
  }

  req.csrfToken = token;

  return next();
}

/**
 * Compatibility middleware.
 * Does not generate tokens automatically.
 * Tokens must only be requested from /api/auth/csrf-token.
 */
function generateCsrfTokenMiddleware(req, res, next) {
  next();
}

module.exports = {
  generateCsrfToken,
  verifyCsrfToken,
  consumeCsrfToken,
  csrfProtection,
  generateCsrfTokenMiddleware,
  isEndpointExempt
};
