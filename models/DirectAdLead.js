const mongoose = require("mongoose");

const directAdLeadSchema = new mongoose.Schema({
  company: String,
  name: String,
  email: { type: String, required: true, index: true },
  placement: String,
  budget: Number,
  message: String,
  status: {
    type: String,
    enum: ["new", "contacted", "won", "lost", "archived"],
    default: "new",
    index: true
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("DirectAdLead", directAdLeadSchema);
