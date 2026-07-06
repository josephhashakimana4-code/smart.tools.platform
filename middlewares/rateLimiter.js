const rateLimit = require("express-rate-limit");

module.exports = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit per IP
  message: "Too many requests, slow down"
});
