const mongoose = require("mongoose");

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  excerpt: String,
  content: String,
  metaTitle: String,
  metaDescription: String,
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  publishedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("BlogPost", blogPostSchema);
