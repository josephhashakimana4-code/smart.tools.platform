const rateLimit = require("express-rate-limit");

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

module.exports = createLimiter;
