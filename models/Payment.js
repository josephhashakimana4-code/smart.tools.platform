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
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
    index: true
  },
  reference: String,
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("Payment", paymentSchema);
