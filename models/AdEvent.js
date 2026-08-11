const mongoose = require("mongoose");

const adEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      default: "none",
      trim: true,
      index: true
    },

    placement: {
      type: String,
      default: "unknown",
      trim: true,
      index: true
    },

    eventType: {
      type: String,
      enum: ["impression", "click", "revenue"],
      required: true,
      index: true
    },

    amount: {
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

    externalEventId: {
      type: String,
      trim: true,
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

adEventSchema.index({
  provider: 1,
  eventType: 1,
  occurredAt: -1
});

module.exports = mongoose.model("AdEvent", adEventSchema);
