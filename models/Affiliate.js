const mongoose = require("mongoose");

const AffiliateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  name: String,

  base_url: {
    type: String,
    required: true
  },

  affiliate_url: {
    type: String,
    default: null
  },

  network: {
    type: String,
    default: null
  },

  clicks: {
    type: Number,
    default: 0
  },

  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Affiliate", AffiliateSchema);
