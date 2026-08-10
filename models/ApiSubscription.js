const mongoose = require("mongoose");

const apiSubscriptionSchema = new mongoose.Schema({
  ownerName: String,
  ownerEmail: { type: String, index: true },
  planSlug: { type: String, default: "free" },
  paymentReference: { type: String, index: true, sparse: true },
  apiKey: { type: String, required: true, unique: true, index: true },
  dailyLimit: { type: Number, default: 100 },
  usedToday: { type: Number, default: 0 },
  lastUsedAt: Date,
  status: {
    type: String,
    enum: ["active", "paused", "cancelled"],
    default: "active",
    index: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ApiSubscription", apiSubscriptionSchema);
