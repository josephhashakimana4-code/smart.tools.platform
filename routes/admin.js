const express = require("express");
const crypto = require("crypto");

const Tool = require("../models/Tool");
const ConvertedFile = require("../models/ConvertedFile");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const SearchLog = require("../models/SearchLog");
const Ad = require("../models/Ad");
const BlogPost = require("../models/BlogPost");
const Subscriber = require("../models/Subscriber");
const Contact = require("../models/contact");
const ErrorLog = require("../models/ErrorLog");
const Plan = require("../models/Plan");
const Payment = require("../models/Payment");
const ApiSubscription = require("../models/ApiSubscription");
const Referral = require("../models/Referral");
const DirectAdLead = require("../models/DirectAdLead");
const BusinessSettings = require("../models/BusinessSettings");

const router = express.Router();

/* =========================
   TOKEN STORE (UPGRADED)
========================= */
const activeTokens = new Map(); 
// token -> { createdAt }

/* 8 hours session */
const TOKEN_LIFETIME = 8 * 60 * 60 * 1000;

/* =========================
   ADMIN PASSWORD
========================= */
function adminPassword() {
  return process.env.ADMIN_PASSWORD || "admin123";
}

/* =========================
   TOKEN GENERATOR (SECURE)
========================= */
function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* =========================
   CLEAN EXPIRED TOKENS
========================= */
function cleanTokens() {
  const now = Date.now();
  for (const [token, data] of activeTokens.entries()) {
    if (now - data.createdAt > TOKEN_LIFETIME) {
      activeTokens.delete(token);
    }
  }
}
setInterval(cleanTokens, 15 * 60 * 1000); // every 15 min

/* =========================
   AUTH MIDDLEWARE (FIXED)
========================= */
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token) {
    return res.status(401).json({ message: "Missing admin token." });
  }

  const session = activeTokens.get(token);

  if (!session) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }

  if (Date.now() - session.createdAt > TOKEN_LIFETIME) {
    activeTokens.delete(token);
    return res.status(401).json({ message: "Session expired. Login again." });
  }

  next();
}

/* =========================
   SLUG UTIL
========================= */
function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* =========================
   LOGIN
========================= */
router.post("/login", (req, res) => {
  const password = String(req.body.password || "");

  if (password !== adminPassword()) {
    return res.status(401).json({ message: "Incorrect password." });
  }

  const token = createToken();

  activeTokens.set(token, {
    createdAt: Date.now()
  });

  res.json({
    success: true,
    token,
    expiresIn: TOKEN_LIFETIME
  });
});

/* =========================
   LOGOUT
========================= */
router.post("/logout", requireAdmin, (req, res) => {
  const token = req.headers["x-admin-token"];
  activeTokens.delete(token);
  res.json({ success: true });
});

/* =========================
   APPLY AUTH BELOW THIS POINT
========================= */
router.use(requireAdmin);

/* =========================
   STATS
========================= */
router.get("/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const month = new Date();
    month.setDate(1);
    month.setHours(0, 0, 0, 0);

    const [
      totalTools,
      activeTools,
      inactiveTools,
      categories,
      downloads,
      metrics,
      topViewed,
      topAffiliate,
      visitorsToday,
      visitorsMonth,
      subscribers,
      unreadContacts,
      adClicks
    ] = await Promise.all([
      Tool.countDocuments({}),
      Tool.countDocuments({ status: "active" }),
      Tool.countDocuments({ status: "inactive" }),

      Tool.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),

      ConvertedFile.aggregate([{
        $group: {
          _id: null,
          files: { $sum: 1 },
          downloads: { $sum: "$downloadCount" },
          size: { $sum: "$size" }
        }
      }]),

      Tool.aggregate([{ $group: { _id: null, views: { $sum: "$views" }, clicks: { $sum: "$affiliateClicks" } } }]),

      Tool.find().sort({ views: -1 }).limit(8),
      Tool.find().sort({ affiliateClicks: -1 }).limit(8),

      AnalyticsEvent.countDocuments({ type: "page_view", createdAt: { $gte: today } }),
      AnalyticsEvent.countDocuments({ type: "page_view", createdAt: { $gte: month } }),

      Subscriber.countDocuments({}),
      Contact.countDocuments({ status: "unread" }),

      Ad.aggregate([{ $group: { _id: null, clicks: { $sum: "$clicks" } } }])
    ]);

    const m = metrics[0] || { views: 0, clicks: 0 };

    res.json({
      totalTools,
      activeTools,
      inactiveTools,
      categories,
      downloads: downloads[0] || {},
      views: m.views,
      affiliateClicks: m.clicks,
      visitorsToday,
      visitorsMonth,
      subscribers,
      unreadContacts,
      adClicks: adClicks[0]?.clicks || 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Stats error" });
  }
});

/* =========================
   TOOLS (EXAMPLE CLEANED ROUTES)
========================= */
router.get("/tools", async (req, res) => {
  const tools = await Tool.find().sort({ name: 1 });
  res.json(tools);
});

router.post("/tools", async (req, res) => {
  const tool = await Tool.create(req.body);
  res.status(201).json(tool);
});

router.delete("/tools/:id", async (req, res) => {
  await Tool.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
