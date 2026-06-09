const express = require("express");
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
const activeTokens = new Set();

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "admin123";
}

function createToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function requireAdmin(req, res, next) {
  const token = req.get("x-admin-token");

  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ message: "Admin login required." });
  }

  next();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanToolPayload(body) {
  const name = String(body.name || "").trim();
  const slug = slugify(body.slug || name);
  const category = String(body.category || "utility").trim().toLowerCase();
  const status = body.status === "inactive" ? "inactive" : "active";

  return {
    name,
    slug,
    category,
    status,
    description: String(body.description || "").trim(),
    affiliateUrl: String(body.affiliateUrl || "").trim(),
    affiliateLabel: String(body.affiliateLabel || "").trim(),
    affiliateCategory: String(body.affiliateCategory || "").trim(),
    metaTitle: String(body.metaTitle || "").trim(),
    metaDescription: String(body.metaDescription || "").trim(),
    metaKeywords: String(body.metaKeywords || "").trim(),
    ogImage: String(body.ogImage || "").trim(),
    canonicalUrl: String(body.canonicalUrl || "").trim()
  };
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function slugifyPost(value) {
  return slugify(value);
}

function cleanAdPayload(body) {
  return {
    title: String(body.title || "").trim(),
    subtitle: String(body.subtitle || "").trim(),
    location: String(body.location || "").trim(),
    cta: String(body.cta || "").trim(),
    image: String(body.image || "").trim(),
    url: String(body.url || "").trim(),
    position: ["top", "sidebar", "footer", "in-tool"].includes(body.position) ? body.position : "top",
    active: body.active !== false && body.active !== "false"
  };
}

function cleanPostPayload(body) {
  const title = String(body.title || "").trim();
  const status = body.status === "published" ? "published" : "draft";
  return {
    title,
    slug: slugifyPost(body.slug || title),
    excerpt: String(body.excerpt || "").trim(),
    content: String(body.content || "").trim(),
    metaTitle: String(body.metaTitle || "").trim(),
    metaDescription: String(body.metaDescription || "").trim(),
    status,
    publishedAt: status === "published" ? (body.publishedAt ? new Date(body.publishedAt) : new Date()) : null
  };
}

function cleanPlanPayload(body) {
  return {
    name: String(body.name || "").trim(),
    slug: slugify(body.slug || body.name),
    price: Number(body.price || 0),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    interval: ["free", "monthly", "yearly", "one-time"].includes(body.interval) ? body.interval : "monthly",
    dailyLimit: Number(body.dailyLimit || 0),
    apiLimit: Number(body.apiLimit || 0),
    adsRemoved: body.adsRemoved === true || body.adsRemoved === "true",
    features: String(body.features || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean),
    active: body.active !== false && body.active !== "false"
  };
}

function cleanPaymentPayload(body) {
  return {
    customerName: String(body.customerName || "").trim(),
    customerEmail: String(body.customerEmail || "").trim().toLowerCase(),
    planSlug: slugify(body.planSlug || ""),
    gateway: ["paypal", "stripe", "flutterwave", "paystack", "manual"].includes(body.gateway) ? body.gateway : "manual",
    amount: Number(body.amount || 0),
    currency: String(body.currency || "USD").trim().toUpperCase(),
    status: ["pending", "paid", "failed", "refunded"].includes(body.status) ? body.status : "pending",
    reference: String(body.reference || "").trim()
  };
}

function cleanSettingsPayload(body) {
  return {
    brandName: String(body.brandName || "Smart Tools Hub").trim(),
    logoUrl: String(body.logoUrl || "").trim(),
    defaultCurrency: String(body.defaultCurrency || "USD").trim().toUpperCase(),
    paypalAccountEmail: String(body.paypalAccountEmail || "").trim().toLowerCase(),
    paymentInstructions: String(body.paymentInstructions || "").trim(),
    paypalUrl: String(body.paypalUrl || "").trim(),
    stripeUrl: String(body.stripeUrl || "").trim(),
    flutterwaveUrl: String(body.flutterwaveUrl || "").trim(),
    paystackUrl: String(body.paystackUrl || "").trim(),
    adsensePublisherId: String(body.adsensePublisherId || "").trim(),
    propellerAdsCode: String(body.propellerAdsCode || "").trim(),
    adsterraCode: String(body.adsterraCode || "").trim(),
    supportedLanguages: String(body.supportedLanguages || "English,French,Kinyarwanda,Swahili,Arabic").split(/\n|,/).map((item) => item.trim()).filter(Boolean),
    socialLinks: {
      youtube: String(body.youtube || "").trim(),
      facebook: String(body.facebook || "").trim(),
      linkedin: String(body.linkedin || "").trim()
    }
  };
}

function validateTool(tool) {
  if (!tool.name) return "Tool name is required.";
  if (!tool.slug) return "Tool slug is required.";
  if (!tool.category) return "Tool category is required.";
  return "";
}

router.post("/login", (req, res) => {
  const password = String(req.body.password || "");

  if (password !== adminPassword()) {
    return res.status(401).json({ message: "Incorrect admin password." });
  }

  const token = createToken();
  activeTokens.add(token);
  res.json({ success: true, token });
});

router.post("/logout", requireAdmin, (req, res) => {
  activeTokens.delete(req.get("x-admin-token"));
  res.json({ success: true });
});

router.use(requireAdmin);

router.get("/stats", async (req, res) => {
  try {
    const today = startOfDay();
    const month = startOfMonth();
    const [total, active, inactive, categories, downloads, metrics, topViewed, topAffiliate, visitorsToday, visitorsMonth, subscribers, contactsUnread, adClicks] = await Promise.all([
      Tool.countDocuments({}),
      Tool.countDocuments({ status: "active" }),
      Tool.countDocuments({ status: "inactive" }),
      Tool.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } }
      ]),
      ConvertedFile.aggregate([
        {
          $group: {
            _id: null,
            files: { $sum: 1 },
            totalDownloads: { $sum: "$downloadCount" },
            totalSize: { $sum: "$size" }
          }
        }
      ]),
      Tool.aggregate([
        {
          $group: {
            _id: null,
            views: { $sum: "$views" },
            affiliateClicks: { $sum: "$affiliateClicks" }
          }
        }
      ]),
      Tool.find({}).sort({ views: -1, name: 1 }).limit(8).select("name slug category views affiliateClicks status"),
      Tool.find({}).sort({ affiliateClicks: -1, name: 1 }).limit(8).select("name slug category views affiliateClicks status"),
      AnalyticsEvent.countDocuments({ type: "page_view", createdAt: { $gte: today } }),
      AnalyticsEvent.countDocuments({ type: "page_view", createdAt: { $gte: month } }),
      Subscriber.countDocuments({ status: "active" }),
      Contact.countDocuments({ status: "unread" }),
      Ad.aggregate([{ $group: { _id: null, clicks: { $sum: "$clicks" } } }])
    ]);

    const metricTotals = metrics[0] || { views: 0, affiliateClicks: 0 };
    const affiliateCtr = metricTotals.views > 0
      ? Number(((metricTotals.affiliateClicks / metricTotals.views) * 100).toFixed(2))
      : 0;

    res.json({
      total,
      active,
      inactive,
      categories,
      views: metricTotals.views || 0,
      affiliateClicks: metricTotals.affiliateClicks || 0,
      affiliateCtr,
      topViewed,
      topAffiliate,
      visitorsToday,
      visitorsMonth,
      subscribers,
      contactsUnread,
      adClicks: adClicks[0]?.clicks || 0,
      estimatedEarnings: Number((((metricTotals.affiliateClicks || 0) * Number(process.env.ESTIMATED_AFFILIATE_EPC || 0.15)) + ((adClicks[0]?.clicks || 0) * Number(process.env.ESTIMATED_AD_EPC || 0.03))).toFixed(2)),
      downloads: downloads[0] || { files: 0, totalDownloads: 0, totalSize: 0 }
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Failed to load dashboard stats." });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const [dailyVisitors, topCountries, trafficSources, searches, noResultSearches, toolViews] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $match: { type: "page_view", createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      AnalyticsEvent.aggregate([
        { $match: { type: "page_view" } },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]),
      AnalyticsEvent.aggregate([
        { $match: { type: "page_view" } },
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      SearchLog.aggregate([
        { $group: { _id: "$query", count: { $sum: 1 }, lastResultCount: { $last: "$resultCount" } } },
        { $sort: { count: -1 } },
        { $limit: 12 }
      ]),
      SearchLog.aggregate([
        { $match: { resultCount: 0 } },
        { $group: { _id: "$query", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 }
      ]),
      Tool.find({}).sort({ views: -1 }).limit(12).select("name slug views affiliateClicks")
    ]);

    res.json({ dailyVisitors, topCountries, trafficSources, searches, noResultSearches, toolViews });
  } catch (err) {
    console.error("Admin analytics error:", err);
    res.status(500).json({ message: "Failed to load analytics." });
  }
});

router.get("/business", async (req, res) => {
  try {
    const month = startOfMonth();
    const [
      plans,
      payments,
      apiSubscriptions,
      referrals,
      directAdLeads,
      settings,
      paidRevenue,
      monthlyRevenue,
      revenueByGateway,
      revenueByPlan
    ] = await Promise.all([
      Plan.find({}).sort({ price: 1, name: 1 }),
      Payment.find({}).sort({ createdAt: -1 }).limit(100),
      ApiSubscription.find({}).sort({ createdAt: -1 }).limit(100),
      Referral.find({}).sort({ createdAt: -1 }).limit(100),
      DirectAdLead.find({}).sort({ createdAt: -1 }).limit(100),
      BusinessSettings.findOneAndUpdate({ key: "default" }, { $setOnInsert: { key: "default" } }, { upsert: true, new: true }),
      Payment.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Payment.aggregate([{ $match: { status: "paid", createdAt: { $gte: month } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Payment.aggregate([{ $match: { status: "paid" } }, { $group: { _id: "$gateway", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Payment.aggregate([{ $match: { status: "paid" } }, { $group: { _id: "$planSlug", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }])
    ]);

    res.json({
      plans,
      payments,
      apiSubscriptions,
      referrals,
      directAdLeads,
      settings,
      summary: {
        totalRevenue: paidRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        activePlans: plans.filter((plan) => plan.active).length,
        activeApiSubscriptions: apiSubscriptions.filter((item) => item.status === "active").length,
        pendingReferrals: referrals.filter((item) => item.status === "pending").length,
        openAdLeads: directAdLeads.filter((item) => item.status === "new" || item.status === "contacted").length
      },
      revenueByGateway,
      revenueByPlan
    });
  } catch (err) {
    console.error("Admin business error:", err);
    res.status(500).json({ message: "Failed to load business dashboard." });
  }
});

router.post("/business/plans", async (req, res) => {
  try {
    const payload = cleanPlanPayload(req.body);
    if (!payload.name || !payload.slug) return res.status(400).json({ message: "Plan name and slug are required." });
    res.status(201).json(await Plan.create(payload));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "A plan with this slug already exists." });
    res.status(500).json({ message: "Failed to create plan." });
  }
});

router.put("/business/plans/:id", async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, cleanPlanPayload(req.body), { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ message: "Plan not found." });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: "Failed to update plan." });
  }
});

router.delete("/business/plans/:id", async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete plan." });
  }
});

router.post("/business/payments", async (req, res) => {
  try {
    res.status(201).json(await Payment.create(cleanPaymentPayload(req.body)));
  } catch (err) {
    res.status(500).json({ message: "Failed to record payment." });
  }
});

router.patch("/business/payments/:id/status", async (req, res) => {
  try {
    const status = ["pending", "paid", "failed", "refunded"].includes(req.body.status) ? req.body.status : "pending";
    const payment = await Payment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: "Failed to update payment." });
  }
});

router.patch("/business/referrals/:id/status", async (req, res) => {
  try {
    const status = ["pending", "approved", "paid", "rejected"].includes(req.body.status) ? req.body.status : "pending";
    const referral = await Referral.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!referral) return res.status(404).json({ message: "Referral not found." });
    res.json(referral);
  } catch (err) {
    res.status(500).json({ message: "Failed to update referral." });
  }
});

router.patch("/business/ad-leads/:id/status", async (req, res) => {
  try {
    const status = ["new", "contacted", "won", "lost", "archived"].includes(req.body.status) ? req.body.status : "new";
    const lead = await DirectAdLead.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!lead) return res.status(404).json({ message: "Ad lead not found." });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: "Failed to update ad lead." });
  }
});

router.patch("/business/api-subscriptions/:id/status", async (req, res) => {
  try {
    const status = ["active", "paused", "cancelled"].includes(req.body.status) ? req.body.status : "active";
    const subscription = await ApiSubscription.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!subscription) return res.status(404).json({ message: "API subscription not found." });
    res.json(subscription);
  } catch (err) {
    res.status(500).json({ message: "Failed to update API subscription." });
  }
});

router.put("/business/settings", async (req, res) => {
  try {
    const settings = await BusinessSettings.findOneAndUpdate(
      { key: "default" },
      cleanSettingsPayload(req.body),
      { upsert: true, new: true, runValidators: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Failed to save business settings." });
  }
});

router.get("/monetization", async (req, res) => {
  try {
    const tools = await Tool.find({})
      .sort({ affiliateClicks: -1, views: -1, name: 1 })
      .select("name slug category status views affiliateClicks affiliateLabel affiliateUrl");

    const rows = tools.map((tool) => {
      const views = tool.views || 0;
      const affiliateClicks = tool.affiliateClicks || 0;

      return {
        _id: tool._id,
        name: tool.name,
        slug: tool.slug,
        category: tool.category,
        status: tool.status,
        views,
        affiliateClicks,
        ctr: views > 0 ? Number(((affiliateClicks / views) * 100).toFixed(2)) : 0,
        affiliateLabel: tool.affiliateLabel,
        hasAffiliate: Boolean(tool.affiliateUrl)
      };
    });

    res.json(rows);
  } catch (err) {
    console.error("Admin monetization error:", err);
    res.status(500).json({ message: "Failed to load monetization data." });
  }
});

router.get("/ads", async (req, res) => {
  try {
    res.json(await Ad.find({}).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ message: "Failed to load ads." });
  }
});

router.post("/ads", async (req, res) => {
  try {
    const payload = cleanAdPayload(req.body);
    if (!payload.title) return res.status(400).json({ message: "Ad title is required." });
    res.status(201).json(await Ad.create(payload));
  } catch (err) {
    res.status(500).json({ message: "Failed to create ad." });
  }
});

router.put("/ads/:id", async (req, res) => {
  try {
    const payload = cleanAdPayload(req.body);
    const ad = await Ad.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!ad) return res.status(404).json({ message: "Ad not found." });
    res.json(ad);
  } catch (err) {
    res.status(500).json({ message: "Failed to update ad." });
  }
});

router.delete("/ads/:id", async (req, res) => {
  try {
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete ad." });
  }
});

router.get("/blog", async (req, res) => {
  try {
    res.json(await BlogPost.find({}).sort({ updatedAt: -1 }));
  } catch (err) {
    res.status(500).json({ message: "Failed to load blog posts." });
  }
});

router.post("/blog", async (req, res) => {
  try {
    const payload = cleanPostPayload(req.body);
    if (!payload.title || !payload.slug) return res.status(400).json({ message: "Blog title and slug are required." });
    res.status(201).json(await BlogPost.create(payload));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "A blog post with this slug already exists." });
    res.status(500).json({ message: "Failed to create blog post." });
  }
});

router.put("/blog/:id", async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, cleanPostPayload(req.body), { new: true, runValidators: true });
    if (!post) return res.status(404).json({ message: "Blog post not found." });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to update blog post." });
  }
});

router.delete("/blog/:id", async (req, res) => {
  try {
    await BlogPost.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete blog post." });
  }
});

router.get("/contacts", async (req, res) => {
  try {
    const status = String(req.query.status || "all");
    const query = status === "all" ? {} : { status };
    res.json(await Contact.find(query).sort({ createdAt: -1 }).limit(100));
  } catch (err) {
    res.status(500).json({ message: "Failed to load contacts." });
  }
});

router.patch("/contacts/:id/status", async (req, res) => {
  try {
    const allowed = ["unread", "read", "archived"];
    const status = allowed.includes(req.body.status) ? req.body.status : "read";
    const contact = await Contact.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!contact) return res.status(404).json({ message: "Contact not found." });
    res.json(contact);
  } catch (err) {
    res.status(500).json({ message: "Failed to update contact." });
  }
});

router.get("/subscribers", async (req, res) => {
  try {
    res.json(await Subscriber.find({}).sort({ createdAt: -1 }).limit(500));
  } catch (err) {
    res.status(500).json({ message: "Failed to load subscribers." });
  }
});

router.get("/errors", async (req, res) => {
  try {
    res.json(await ErrorLog.find({}).sort({ createdAt: -1 }).limit(100));
  } catch (err) {
    res.status(500).json({ message: "Failed to load errors." });
  }
});

router.post("/metrics/reset", async (req, res) => {
  try {
    await Tool.updateMany({}, {
      $set: {
        views: 0,
        affiliateClicks: 0,
        lastViewedAt: null,
        lastAffiliateClickAt: null
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Admin metrics reset error:", err);
    res.status(500).json({ message: "Failed to reset metrics." });
  }
});

router.get("/tools", async (req, res) => {
  try {
    const query = {};
    const search = String(req.query.q || "").trim();
    const status = String(req.query.status || "all").trim();
    const category = String(req.query.category || "all").trim();

    if (status !== "all") query.status = status;
    if (category !== "all") query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const tools = await Tool.find(query).sort({ name: 1 });
    res.json(tools);
  } catch (err) {
    console.error("Admin tools list error:", err);
    res.status(500).json({ message: "Failed to load tools." });
  }
});

router.post("/tools", async (req, res) => {
  try {
    const payload = cleanToolPayload(req.body);
    const validationError = validateTool(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const exists = await Tool.findOne({ slug: payload.slug });
    if (exists) {
      return res.status(409).json({ message: "A tool with this slug already exists." });
    }

    const tool = await Tool.create(payload);
    res.status(201).json(tool);
  } catch (err) {
    console.error("Admin create tool error:", err);
    res.status(500).json({ message: "Failed to create tool." });
  }
});

router.put("/tools/:id", async (req, res) => {
  try {
    const payload = cleanToolPayload(req.body);
    const validationError = validateTool(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const duplicate = await Tool.findOne({
      _id: { $ne: req.params.id },
      slug: payload.slug
    });

    if (duplicate) {
      return res.status(409).json({ message: "Another tool already uses this slug." });
    }

    const tool = await Tool.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!tool) return res.status(404).json({ message: "Tool not found." });
    res.json(tool);
  } catch (err) {
    console.error("Admin update tool error:", err);
    res.status(500).json({ message: "Failed to update tool." });
  }
});

router.patch("/tools/:id/status", async (req, res) => {
  try {
    const status = req.body.status === "inactive" ? "inactive" : "active";
    const tool = await Tool.findByIdAndUpdate(req.params.id, { status }, { new: true });

    if (!tool) return res.status(404).json({ message: "Tool not found." });
    res.json(tool);
  } catch (err) {
    console.error("Admin status update error:", err);
    res.status(500).json({ message: "Failed to update tool status." });
  }
});

router.delete("/tools/:id", async (req, res) => {
  try {
    const tool = await Tool.findByIdAndDelete(req.params.id);
    if (!tool) return res.status(404).json({ message: "Tool not found." });
    res.json({ success: true, deleted: tool._id });
  } catch (err) {
    console.error("Admin delete tool error:", err);
    res.status(500).json({ message: "Failed to delete tool." });
  }
});

module.exports = router;
