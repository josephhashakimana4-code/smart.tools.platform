const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  price: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  interval: { type: String, enum: ["free", "monthly", "yearly", "one-time"], default: "monthly" },
  dailyLimit: { type: Number, default: 100 },
  apiLimit: { type: Number, default: 100 },
  adsRemoved: { type: Boolean, default: false },
  features: [String],
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Plan", planSchema);
