const mongoose = require("mongoose");

const errorLogSchema = new mongoose.Schema({
  type: { type: String, default: "system" },
  message: String,
  stack: String,
  path: String,
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("ErrorLog", errorLogSchema);
