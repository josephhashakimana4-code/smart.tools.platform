const mongoose = require("mongoose");

const convertedFileSchema = new mongoose.Schema({
  toolSlug: { type: String, required: true },
  originalName: String,
  filename: { type: String, required: true },
  path: { type: String, required: true },
  mimeType: String,
  size: Number,
  status: { type: String, default: "ready" },
  downloadCount: { type: Number, default: 0 },
  lastDownloadedAt: Date,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 }
});

module.exports = mongoose.model("ConvertedFile", convertedFileSchema);
