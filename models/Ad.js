const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    subtitle: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    location: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ""
    },

    cta: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "Learn more"
    },

    image: {
      type: String,
      trim: true,
      default: ""
    },

    url: {
      type: String,
      trim: true,
      default: ""
    },

    position: {
      type: String,
      enum: ["top", "sidebar", "footer", "in-tool"],
      default: "top",
      index: true
    },

    active: {
      type: Boolean,
      default: true,
      index: true
    },

    clicks: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Ad", adSchema);
