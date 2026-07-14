const winston = require("winston");
const fs = require("fs");
const path = require("path");

// Ensure logs directory exists
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Audit logger for security events
 */
const auditLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "audit" },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, "audit.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "error-audit.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== "production") {
  auditLogger.add(
    new winston.transports.Console({
      format: winston.format.simple()
    })
  );
}

/**
 * Log authentication events
 */
function logAuthEvent(eventType, userId, email, ipAddress, userAgent, success, reason = "") {
  auditLogger.info({
    eventType,
    userId,
    email,
    ipAddress,
    userAgent,
    success,
    reason,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log security events
 */
function logSecurityEvent(eventType, userId, details, severity = "medium") {
  auditLogger.warn({
    eventType,
    userId,
    details,
    severity,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log API access
 */
function logApiAccess(method, endpoint, userId, statusCode, ipAddress, responseTime) {
  auditLogger.debug({
    type: "api_access",
    method,
    endpoint,
    userId,
    statusCode,
    ipAddress,
    responseTime,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log data access
 */
function logDataAccess(userId, action, dataType, resourceId, success) {
  auditLogger.info({
    type: "data_access",
    userId,
    action,
    dataType,
    resourceId,
    success,
    timestamp: new Date().toISOString()
  });
}

/**
 * Middleware to log all API requests
 */
function auditMiddleware(req, res, next) {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const responseTime = Date.now() - startTime;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("user-agent");
    const userId = req.user?._id || "anonymous";

    // Log non-health check endpoints
    if (req.path !== "/health") {
      logApiAccess(req.method, req.path, userId, res.statusCode, ipAddress, responseTime);
    }

    return originalSend.call(this, data);
  };

  next();
}

module.exports = {
  auditLogger,
  logAuthEvent,
  logSecurityEvent,
  logApiAccess,
  logDataAccess,
  auditMiddleware
};
