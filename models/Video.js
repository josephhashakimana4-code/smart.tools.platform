const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
  description: { type: String, trim: true, maxlength: 1200, default: "" },
  videoUrl: { type: String, required: true, trim: true, maxlength: 2048 },
  thumbnailUrl: { type: String, trim: true, maxlength: 2048, default: "" },
  toolUrl: { type: String, trim: true, maxlength: 2048, default: "" },
  toolLabel: { type: String, trim: true, maxlength: 80, default: "Try the related tool" },
  category: { type: String, trim: true, maxlength: 80, default: "Tutorial" },
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  views: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Video", videoSchema);
