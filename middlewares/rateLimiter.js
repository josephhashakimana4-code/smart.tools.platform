const rateLimit = require("express-rate-limit");

const slowDownStore = new Map();

function createLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please try again later."
    }
  });
}

function createSlowDown(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const delayAfter = options.delayAfter || 20;
  const delayMs = options.delayMs || 500;
  const maxDelay = options.maxDelay || 3000;

  return (req, res, next) => {
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const key = `${ipAddress}:${req.method}:${req.path}`;
    const now = Date.now();
    const entry = slowDownStore.get(key) || { count: 0, startTime: now };

    if (now - entry.startTime > windowMs) {
      entry.count = 0;
      entry.startTime = now;
    }

    entry.count += 1;
    slowDownStore.set(key, entry);

    const delayCount = entry.count - delayAfter;
    if (delayCount > 0) {
      const delay = Math.min(delayCount * delayMs, maxDelay);
      return setTimeout(next, delay);
    }

    next();
  };
}

module.exports = createLimiter;
module.exports.createSlowDown = createSlowDown;
