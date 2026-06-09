const mongoose = require("mongoose");

const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ["active", "unsubscribed"], default: "active" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Subscriber", subscriberSchema);
