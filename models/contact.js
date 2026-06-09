const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  status: { type: String, enum: ["unread", "read", "archived"], default: "unread", index: true }
}, { timestamps: true });

module.exports = mongoose.model("Contact", contactSchema);
