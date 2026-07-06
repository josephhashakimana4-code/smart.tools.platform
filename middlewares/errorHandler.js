const ErrorLog = require("../models/ErrorLog");

module.exports = async function (err, req, res, next) {
  console.error("SERVER ERROR:", err);

  try {
    await ErrorLog.create({
      type: "server_error",
      message: err.message,
      stack: err.stack,
      path: req.originalUrl
    });
  } catch (e) {
    console.error("Failed to log error:", e.message);
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
};
