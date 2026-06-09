const mongoose = require("mongoose");

const searchLogSchema = new mongoose.Schema({
  query: { type: String, required: true, index: true },
  resultCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("SearchLog", searchLogSchema);
