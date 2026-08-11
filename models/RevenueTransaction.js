const mongoose = require("mongoose");

const revenueTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    source: {
      type: String,
      enum: [
        "subscription",
        "affiliate",
        "advertising",
        "direct_ad"
      ],
      required: true,
      index: true
    },

    sourceId: {
      type: String,
      trim: true,
      default: null,
      index: true
    },

    amount: {
      type: Number,
      default: 0,
      min: 0
    },

    gross: {
      type: Number,
      default: 0,
      min: 0
    },

    fees: {
      type: Number,
      default: 0,
      min: 0
    },

    net: {
      type: Number,
      default: 0
    },

    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true
    },

    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "refunded",
        "failed",
        "reversed"
      ],
      default: "pending",
      index: true
    },

    provider: {
      type: String,
      default: "internal",
      trim: true
    },

    providerTransactionId: {
      type: String,
      trim: true,
      default: null,
      index: true
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

revenueTransactionSchema.index({
  source: 1,
  status: 1,
  occurredAt: -1
});

module.exports = mongoose.model(
  "RevenueTransaction",
  revenueTransactionSchema
);
