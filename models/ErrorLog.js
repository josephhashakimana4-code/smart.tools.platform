const mongoose = require("mongoose");

const errorLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: "system",
      index: true
    },

    message: {
      type: String,
      required: true
    },

    stack: {
      type: String,
      default: null
    },

    path: {
      type: String,
      default: null,
      index: true
    },

    method: {
      type: String,
      default: null
    },

    ip: {
      type: String,
      default: null
    },

    userAgent: {
      type: String,
      default: null
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   INDEXES (PERFORMANCE)
========================= */
errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("ErrorLog", errorLogSchema);
