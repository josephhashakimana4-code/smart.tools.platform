const mongoose = require("mongoose");

const affiliateConversionSchema = new mongoose.Schema(
  {
    affiliate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Affiliate",
      default: null,
      index: true
    },

    tool: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tool",
      default: null,
      index: true
    },

    clickId: {
      type: String,
      trim: true,
      index: true
    },

    externalConversionId: {
      type: String,
      trim: true,
      index: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "reversed"],
      default: "pending",
      index: true
    },

    conversionValue: {
      type: Number,
      default: 0,
      min: 0
    },

    commissionAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    approvedAt: {
      type: Date,
      default: null
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

affiliateConversionSchema.index({
  affiliate: 1,
  status: 1,
  occurredAt: -1
});

affiliateConversionSchema.index({
  tool: 1,
  status: 1,
  occurredAt: -1
});

module.exports = mongoose.model(
  "AffiliateConversion",
  affiliateConversionSchema
);
