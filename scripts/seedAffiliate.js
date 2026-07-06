const mongoose = require("mongoose");
const Affiliate = require("../models/Affiliate");

require("dotenv").config();

const toolsArray = [
  {
    key: "canva",
    name: "Canva",
    base_url: "https://www.canva.com/",
    affiliate_url: "https://www.canva.com/",
    network: "Impact",
    active: true
  },
  {
    key: "notion",
    name: "Notion",
    base_url: "https://www.notion.so/",
    affiliate_url: "https://www.notion.so/",
    network: "Impact",
    active: true
  },
  {
    key: "github",
    name: "GitHub",
    base_url: "https://github.com/",
    affiliate_url: null,
    network: "Direct",
    active: true
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/toolsdb");

    console.log("Connected to MongoDB");

    await Affiliate.deleteMany(); // optional reset

    await Affiliate.insertMany(toolsArray);

    console.log("Affiliate data inserted successfully");

    process.exit();
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
