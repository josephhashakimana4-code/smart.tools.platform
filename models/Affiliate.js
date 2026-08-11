const mongoose = require("mongoose");

const AffiliateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true
    },

    name: {
      type: String,
      trim: true,
      default: ""
    },

    network: {
      type: String,
      trim: true,
      default: null
    },

    base_url: {
      type: String,
      required: true,
      trim: true
    },

    affiliate_url: {
      type: String,
      default: null,
      trim: true
    },

    active: {
      type: Boolean,
      default: true,
      index: true
    },

    trackingEnabled: {
      type: Boolean,
      default: true
    },

    commissionType: {
      type: String,
      enum: ["percentage", "fixed", "none"],
      default: "none"
    },

    commissionRate: {
      type: Number,
      default: 0,
      min: 0
    },

    commissionCurrency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true
    },

    clicks: {
      type: Number,
      default: 0,
      min: 0
    },

    conversions: {
      type: Number,
      default: 0,
      min: 0
    },

    approvedConversions: {
      type: Number,
      default: 0,
      min: 0
    },

    totalCommission: {
      type: Number,
      default: 0,
      min: 0
    },

    lastClickAt: {
      type: Date,
      default: null
    },

    lastConversionAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

AffiliateSchema.index({
  active: 1,
  network: 1
});

module.exports = mongoose.model("Affiliate", AffiliateSchema);
