const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  customerEmail: { type: String, required: true, index: true, lowercase: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  planSlug: { type: String, required: true, index: true },
  status: { type: String, enum: ["active", "past_due", "cancelled", "expired"], default: "active", index: true },
  provider: { type: String, default: "stripe" },
  providerCustomerId: { type: String, index: true, sparse: true },
  providerSubscriptionId: { type: String, unique: true, sparse: true, index: true },
  paymentReference: { type: String, unique: true, sparse: true, index: true },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
