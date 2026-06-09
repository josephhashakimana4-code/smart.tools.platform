const express = require("express");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const SearchLog = require("../models/SearchLog");
const Tool = require("../models/Tool");
const Subscriber = require("../models/Subscriber");
const Ad = require("../models/Ad");

const router = express.Router();

function detectDevice(userAgent = "") {
  return /mobile|android|iphone|ipad/i.test(userAgent) ? "mobile" : "desktop";
}

function detectSource(referrer = "") {
  if (!referrer) return "direct";
  if (/google\./i.test(referrer)) return "google";
  if (/bing\./i.test(referrer)) return "bing";
  if (/facebook|instagram|twitter|x\.com|linkedin/i.test(referrer)) return "social";
  return "referral";
}

router.post("/event", async (req, res) => {
  try {
    const body = req.body || {};
    const type = String(body.type || "page_view").trim();
    await AnalyticsEvent.create({
      type,
      path: String(body.path || "").slice(0, 300),
      toolSlug: String(body.toolSlug || "").slice(0, 120),
      country: String(req.get("cf-ipcountry") || body.country || "Unknown").slice(0, 80),
      device: detectDevice(req.get("user-agent")),
      source: detectSource(String(body.referrer || req.get("referer") || "")),
      metadata: body.metadata || {}
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Analytics event error:", err);
    res.status(500).json({ message: "Failed to save analytics event." });
  }
});

router.post("/search", async (req, res) => {
  try {
    const query = String(req.body.query || "").trim().slice(0, 160);
    if (!query) return res.json({ success: true, skipped: true });

    await SearchLog.create({
      query,
      resultCount: Number(req.body.resultCount || 0)
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Search log error:", err);
    res.status(500).json({ message: "Failed to save search log." });
  }
});

router.post("/newsletter", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    await Subscriber.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true });
    res.json({ success: true });
  } catch (err) {
    console.error("Newsletter signup error:", err);
    res.status(500).json({ message: "Failed to save subscriber." });
  }
});

router.get("/ads", async (req, res) => {
  try {
    const position = String(req.query.position || "").trim();
    const query = { active: true };
    if (position) query.position = position;
    const ads = await Ad.find(query).sort({ createdAt: -1 }).limit(8);
    res.json(ads);
  } catch (err) {
    console.error("Ads fetch error:", err);
    res.status(500).json({ message: "Failed to load ads." });
  }
});

router.post("/ads/:id/click", async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to track ad click." });
  }
});

router.get("/related-tools/:slug", async (req, res) => {
  try {
    const current = await Tool.findOne({ slug: req.params.slug, status: "active" });
    const related = current
      ? await Tool.find({ _id: { $ne: current._id }, category: current.category, status: "active" }).sort({ views: -1 }).limit(4)
      : [];
    const popular = await Tool.find({ status: "active" }).sort({ views: -1, affiliateClicks: -1 }).limit(4);
    res.json({ related, popular });
  } catch (err) {
    console.error("Related tools error:", err);
    res.status(500).json({ message: "Failed to load related tools." });
  }
});

module.exports = router;
