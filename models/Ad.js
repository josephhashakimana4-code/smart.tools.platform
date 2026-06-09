const mongoose = require("mongoose");

const adSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: String,
  location: String,
  cta: String,
  image: String,
  url: String,
  position: {
    type: String,
    enum: ["top", "sidebar", "footer", "in-tool"],
    default: "top",
    index: true
  },
  active: { type: Boolean, default: true },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ad", adSchema);
