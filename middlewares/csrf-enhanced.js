const crypto = require("crypto");

/**
 * Enhanced CSRF Protection Middleware
 * Validates CSRF tokens on all state-changing requests
 * Supports endpoint-specific CSRF requirements
 */

const csrfTokens = new Map();
const requestSignatures = new Map();

// Configuration for endpoint-specific CSRF handling
const endpointCsrfConfig = {
  // Critical operations require fresh tokens
  critical: [
    "/api/admin/users",
    "/api/admin/settings",
    "/api/business/payment",
    "/api/auth/password-change",
    "/api/auth/email-change",
    "/api/user/delete-account"
  ],
  
  // Operations that can use cached tokens (broader timeframes)
  standard: [
    "/api/tools",
    "/api/blog",
    "/api/ads",
    "/api/analytics"
  ],

  // Public endpoints exempt from CSRF
  exempt: [
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/csrf-token",
    "/api/business/webhooks/stripe",
    "/api/contact",
    "/health",
    "/api/health"
  ]
};

// Clean expired tokens every 30 minutes
const csrfCleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.createdAt > maxAge) {
      csrfTokens.delete(token);
    }
  }

  // Clean old request signatures
  for (const [sig, data] of requestSignatures.entries()) {
    if (now - data.createdAt > 30 * 60 * 1000) {
      requestSignatures.delete(sig);
    }
  }
}, 30 * 60 * 1000);

if (csrfCleanupInterval.unref) {
  csrfCleanupInterval.unref();
}

/**
 * Generate CSRF token with optional binding
 */
function generateCsrfToken(userId = null, metadata = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(token, {
    createdAt: Date.now(),
    userId,
    metadata,
    used: false,
    usedAt: null
  });
  return token;
}

/**
 * Generate request signature for double-submit cookie pattern
 */
function generateRequestSignature(data = {}) {
  const signature = crypto.randomBytes(32).toString("hex");
  requestSignatures.set(signature, {
    createdAt: Date.now(),
    data,
    used: false
  });
  return signature;
}

/**
 * Verify CSRF token
 */
function verifyCsrfToken(token, userId = null, endpoint = "") {
  if (!token || !csrfTokens.has(token)) {
    return {
      valid: false,
      message: "CSRF token missing or invalid",
      code: "CSRF_INVALID"
    };
  }

  const tokenData = csrfTokens.get(token);
  const now = Date.now();

  // Check token age
  const isCritical = endpointCsrfConfig.critical.some(path => endpoint.includes(path));
  const maxAge = isCritical ? 15 * 60 * 1000 : 60 * 60 * 1000; // 15 min for critical, 1 hour for standard

  if (now - tokenData.createdAt > maxAge) {
    csrfTokens.delete(token);
    return {
      valid: false,
      message: "CSRF token expired",
      code: "CSRF_EXPIRED"
    };
  }

  // Validate token binding if user is authenticated
  if (userId && tokenData.userId && tokenData.userId !== userId) {
    return {
      valid: false,
      message: "CSRF token does not match user context",
      code: "CSRF_MISMATCH"
    };
  }

  return {
    valid: true,
    message: "CSRF token valid"
  };
}

/**
 * Check if endpoint is CSRF-exempt
 */
function isEndpointExempt(endpoint) {
  return endpointCsrfConfig.exempt.some(exemptPath => {
    if (exemptPath.includes("*")) {
      const pattern = exemptPath.replace(/\*/g, ".*");
      return new RegExp(pattern).test(endpoint);
    }
    return endpoint.startsWith(exemptPath);
  });
}

/**
 * Get CSRF endpoint classification
 */
function getEndpointCsrfLevel(endpoint) {
  if (endpointCsrfConfig.critical.some(path => endpoint.includes(path))) {
    return "critical";
  }
  if (endpointCsrfConfig.standard.some(path => endpoint.includes(path))) {
    return "standard";
  }
  return "default";
}

/**
 * Consume CSRF token (one-time use for critical operations)
 */
function consumeCsrfToken(token, critical = false) {
  if (!csrfTokens.has(token)) {
    return false;
  }

  const tokenData = csrfTokens.get(token);

  if (critical) {
    csrfTokens.delete(token);
  } else {
    // For standard operations, just mark as used
    tokenData.used = true;
    tokenData.usedAt = Date.now();
  }

  return true;
}

/**
 * Main CSRF Protection Middleware
 */
function csrfProtection(req, res, next) {
  // Skip CSRF check for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const endpoint = req.path;

  // Skip for exempt endpoints
  if (isEndpointExempt(endpoint)) {
    return next();
  }

  const token = req.headers["x-csrf-token"] || 
                req.headers["X-CSRF-Token"] || 
                req.body?.csrfToken ||
                req.query?.csrfToken;

  if (!token) {
    return res.status(403).json({
      success: false,
      message: "CSRF token missing",
      code: "CSRF_MISSING"
    });
  }

  // Verify CSRF token
  const verification = verifyCsrfToken(token, req.user?._id, endpoint);

  if (!verification.valid) {
    return res.status(403).json({
      success: false,
      message: verification.message,
      code: verification.code
    });
  }

  // Attach CSRF info to request
  req.csrfToken = token;
  req.csrfLevel = getEndpointCsrfLevel(endpoint);

  // Handle token consumption after successful response
  res.once("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Consume critical tokens after use
      const isCritical = req.csrfLevel === "critical";
      consumeCsrfToken(token, isCritical);
    }
  });

  next();
}

/**
 * Generate CSRF token middleware
 * Provides CSRF token to client for subsequent requests
 */
function generateCsrfTokenMiddleware(req, res, next) {
  const token = generateCsrfToken(req.user?._id);
  
  res.locals.csrfToken = token;
  res.setHeader("X-CSRF-Token", token);
  
  if (!req.csrfTokenEndpoint) {
    req.csrfTokenEndpoint = token;
  }

  next();
}

/**
 * Endpoint-specific CSRF requirement
 * Usage: app.post('/critical-endpoint', requireStrictCsrf(), handler)
 */
function requireStrictCsrf() {
  return (req, res, next) => {
    const isCritical = endpointCsrfConfig.critical.some(path => 
      req.path.includes(path)
    );

    if (!isCritical) {
      return next();
    }

    // Token must be fresh (less than 5 minutes old) for critical operations
    const token = req.headers["x-csrf-token"] || req.body?.csrfToken;
    
    if (!token || !csrfTokens.has(token)) {
      return res.status(403).json({
        success: false,
        message: "Fresh CSRF token required for this operation",
        code: "CSRF_MUST_BE_FRESH"
      });
    }

    const tokenData = csrfTokens.get(token);
    const age = Date.now() - tokenData.createdAt;
    
    if (age > 5 * 60 * 1000) { // 5 minutes
      return res.status(403).json({
        success: false,
        message: "CSRF token expired. Please refresh and try again.",
        code: "CSRF_TOO_OLD"
      });
    }

    next();
  };
}

/**
 * Add CSRF token to response locals for template rendering
 */
function csrfTokenToLocals(req, res, next) {
  const token = generateCsrfToken(req.user?._id);
  res.locals.csrfToken = token;
  next();
}

module.exports = {
  generateCsrfToken,
  generateRequestSignature,
  verifyCsrfToken,
  isEndpointExempt,
  getEndpointCsrfLevel,
  consumeCsrfToken,
  csrfProtection,
  generateCsrfTokenMiddleware,
  requireStrictCsrf,
  csrfTokenToLocals,
  endpointCsrfConfig
};
