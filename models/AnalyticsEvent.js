const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  path: String,
  toolSlug: String,
  country: String,
  device: String,
  source: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);
