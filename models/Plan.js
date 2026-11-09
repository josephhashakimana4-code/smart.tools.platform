const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  price: { type: Number, default: 0 },
  momoPriceRwf: {
    type: Number,
    min: 0,
    default: null,
    validate: { validator: (value) => value == null || Number.isInteger(value), message: "RWF plan prices must be whole numbers." }
  },
  currency: { type: String, default: "USD" },
  interval: { type: String, enum: ["free", "monthly", "yearly", "one-time"], default: "monthly" },
  dailyLimit: { type: Number, default: 100 },
  apiLimit: { type: Number, default: 100 },
  adsRemoved: { type: Boolean, default: false },
  paypalProductId: String,
  paypalPlanId: String,
  paypalPlanAmount: String,
  paypalPlanCurrency: String,
  paypalPlanInterval: String,
  features: [String],
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Plan", planSchema);
