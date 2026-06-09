const mongoose = require("mongoose");

const toolSchema = new mongoose.Schema({
  name: String,
  category: String,
  slug: String,
  description: String,
  affiliateUrl: String,
  affiliateLabel: String,
  affiliateCategory: String,
  metaTitle: String,
  metaDescription: String,
  metaKeywords: String,
  ogImage: String,
  canonicalUrl: String,
  views: { type: Number, default: 0 },
  affiliateClicks: { type: Number, default: 0 },
  lastViewedAt: Date,
  lastAffiliateClickAt: Date,
  status: { type: String, default: "active" }
});

module.exports = mongoose.model("Tool", toolSchema);
