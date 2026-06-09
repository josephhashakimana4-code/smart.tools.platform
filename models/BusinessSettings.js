const mongoose = require("mongoose");

const businessSettingsSchema = new mongoose.Schema({
  key: { type: String, default: "default", unique: true },
  brandName: { type: String, default: "Smart Tools Hub" },
  logoUrl: String,
  defaultCurrency: { type: String, default: "USD" },
  paypalAccountEmail: String,
  paymentInstructions: String,
  paypalUrl: String,
  stripeUrl: String,
  flutterwaveUrl: String,
  paystackUrl: String,
  adsensePublisherId: String,
  propellerAdsCode: String,
  adsterraCode: String,
  supportedLanguages: {
    type: [String],
    default: ["English", "French", "Kinyarwanda", "Swahili", "Arabic"]
  },
  socialLinks: {
    youtube: String,
    facebook: String,
    linkedin: String
  }
}, { timestamps: true });

module.exports = mongoose.model("BusinessSettings", businessSettingsSchema);
