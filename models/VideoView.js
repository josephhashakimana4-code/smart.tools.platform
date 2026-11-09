const mongoose = require("mongoose");

const videoViewSchema = new mongoose.Schema({
  videoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  visitorHash: { type: String, required: true },
  day: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

videoViewSchema.index({ videoId: 1, visitorHash: 1, day: 1 }, { unique: true });
module.exports = mongoose.model("VideoView", videoViewSchema);
