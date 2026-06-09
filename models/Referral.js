const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
  referrerEmail: { type: String, required: true, index: true },
  invitedEmail: { type: String, required: true },
  rewardType: {
    type: String,
    enum: ["premium-days", "credits", "commission"],
    default: "premium-days"
  },
  rewardValue: { type: Number, default: 7 },
  status: {
    type: String,
    enum: ["pending", "approved", "paid", "rejected"],
    default: "pending",
    index: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Referral", referralSchema);
