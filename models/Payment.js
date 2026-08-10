const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  customerName: String,
  customerEmail: { type: String, index: true },
  planSlug: String,
  gateway: {
    type: String,
    enum: ["paypal", "stripe", "flutterwave", "paystack", "manual"],
    default: "manual"
  },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  status: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded", "cancelled"],
    default: "pending",
    index: true
  },
  reference: String,
  providerSessionId: { type: String, index: true, sparse: true },
  providerSubscriptionId: { type: String, index: true, sparse: true },
  providerCustomerId: { type: String, index: true, sparse: true },
  providerPaymentIntentId: { type: String, index: true, sparse: true },
  latestInvoiceId: { type: String, index: true, sparse: true },
  receiptNumber: { type: String, index: true, sparse: true },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  refundedAt: Date,
  failedAt: Date,
  processedEventIds: { type: [String], default: [] },
  fulfilledAt: Date,
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("Payment", paymentSchema);
