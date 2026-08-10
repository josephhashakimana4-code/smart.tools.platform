const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");

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
const Subscription = require("../models/Subscription");
const ApiSubscription = require("../models/ApiSubscription");
const Referral = require("../models/Referral");
const DirectAdLead = require("../models/DirectAdLead");
const BusinessSettings = require("../models/BusinessSettings");
const Affiliate = require("../models/Affiliate");
const { getFallbackTools } = require("../config/fallbackTools");

const router = express.Router();

const memoryState = {
  tools: getFallbackTools(),
  ads: [],
  affiliates: [],
  blogPosts: [],
  subscribers: [],
  contacts: [],
  plans: [],
  payments: [],
  apiSubscriptions: [],
  settings: {
    key: "default",
    brandName: "Smart Tools Hub",
    logoUrl: "",
    paypalAccountEmail: "",
    paypalUrl: "",
    adsensePublisherId: "",
    propellerAdsCode: "",
    adsterraCode: "",
    socialLinks: {
      facebook: "",
      linkedin: "",
      youtube: ""
    }
  }
};

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
const adminCleanupInterval = setInterval(cleanTokens, 15 * 60 * 1000); // every 15 min
if (adminCleanupInterval.unref) {
  adminCleanupInterval.unref();
}

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
    if (!isDbReady()) {
      const tools = memoryState.tools;
      return res.json({
        totalTools: tools.length,
        activeTools: tools.filter((tool) => tool.status === "active").length,
        inactiveTools: tools.filter((tool) => tool.status !== "active").length,
        categories: [...new Set(tools.map((tool) => tool.category).filter(Boolean))].map((category) => ({ _id: category, count: tools.filter((tool) => tool.category === category).length })),
        downloads: {},
        views: tools.reduce((sum, tool) => sum + Number(tool.views || 0), 0),
        affiliateClicks: tools.reduce((sum, tool) => sum + Number(tool.affiliateClicks || 0), 0),
        visitorsToday: 0,
        visitorsMonth: 0,
        subscribers: memoryState.subscribers.length,
        unreadContacts: memoryState.contacts.filter((contact) => contact.status !== "read").length,
        adClicks: memoryState.ads.reduce((sum, ad) => sum + Number(ad.clicks || 0), 0)
      });
    }

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
   TOOLS
========================= */
router.get("/tools", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.tools.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))));
  }

  const tools = await Tool.find().sort({ name: 1 });
  res.json(tools);
});

router.post("/tools", async (req, res) => {
  if (!isDbReady()) {
    const tool = { _id: makeId(), ...req.body, views: 0, affiliateClicks: 0, status: req.body.status || "active" };
    memoryState.tools.push(tool);
    return res.status(201).json(tool);
  }

  const tool = await Tool.create(req.body);
  res.status(201).json(tool);
});

router.put("/tools/:id", async (req, res) => {
  try {
    if (!isDbReady()) {
      const index = memoryState.tools.findIndex((tool) => tool._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: "Tool not found." });
      memoryState.tools[index] = { ...memoryState.tools[index], ...req.body };
      return res.json(memoryState.tools[index]);
    }

    const tool = await Tool.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!tool) return res.status(404).json({ message: "Tool not found." });
    res.json(tool);
  } catch (err) {
    res.status(500).json({ message: "Failed to update tool." });
  }
});

router.delete("/tools/:id", async (req, res) => {
  if (!isDbReady()) {
    memoryState.tools = memoryState.tools.filter((tool) => tool._id !== req.params.id);
    return res.json({ success: true });
  }

  await Tool.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   ADS
========================= */
router.get("/ads", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.ads.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  }

  const ads = await Ad.find().sort({ createdAt: -1 });
  res.json(ads);
});

router.post("/ads", async (req, res) => {
  if (!isDbReady()) {
    const ad = { _id: makeId(), ...req.body, clicks: 0, createdAt: new Date().toISOString() };
    memoryState.ads.push(ad);
    return res.status(201).json(ad);
  }

  const ad = await Ad.create(req.body);
  res.status(201).json(ad);
});

router.put("/ads/:id", async (req, res) => {
  if (!isDbReady()) {
    const index = memoryState.ads.findIndex((ad) => ad._id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Ad not found." });
    memoryState.ads[index] = { ...memoryState.ads[index], ...req.body };
    return res.json(memoryState.ads[index]);
  }

  const ad = await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!ad) return res.status(404).json({ message: "Ad not found." });
  res.json(ad);
});

router.delete("/ads/:id", async (req, res) => {
  if (!isDbReady()) {
    memoryState.ads = memoryState.ads.filter((ad) => ad._id !== req.params.id);
    return res.json({ success: true });
  }

  await Ad.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   AFFILIATES
========================= */
router.get("/affiliates", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.affiliates.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  }

  const affiliates = await Affiliate.find().sort({ createdAt: -1 });
  res.json(affiliates);
});

router.post("/affiliates", async (req, res) => {
  if (!isDbReady()) {
    const affiliate = { _id: makeId(), ...req.body, clicks: 0, createdAt: new Date().toISOString() };
    memoryState.affiliates.push(affiliate);
    return res.status(201).json(affiliate);
  }

  const affiliate = await Affiliate.create(req.body);
  res.status(201).json(affiliate);
});

router.put("/affiliates/:id", async (req, res) => {
  if (!isDbReady()) {
    const index = memoryState.affiliates.findIndex((affiliate) => affiliate._id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Affiliate not found." });
    memoryState.affiliates[index] = { ...memoryState.affiliates[index], ...req.body };
    return res.json(memoryState.affiliates[index]);
  }

  const affiliate = await Affiliate.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!affiliate) return res.status(404).json({ message: "Affiliate not found." });
  res.json(affiliate);
});

router.delete("/affiliates/:id", async (req, res) => {
  if (!isDbReady()) {
    memoryState.affiliates = memoryState.affiliates.filter((affiliate) => affiliate._id !== req.params.id);
    return res.json({ success: true });
  }

  await Affiliate.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   BUSINESS SETTINGS
========================= */
router.get("/business-settings", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.settings);
  }

  const settings = await BusinessSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { upsert: true, new: true }
  );
  res.json(settings);
});

router.put("/business-settings", async (req, res) => {
  if (!isDbReady()) {
    memoryState.settings = { ...memoryState.settings, ...req.body, key: "default" };
    return res.json(memoryState.settings);
  }

  const settings = await BusinessSettings.findOneAndUpdate(
    { key: "default" },
    { $set: { ...req.body, key: "default" } },
    { upsert: true, new: true, runValidators: true }
  );
  res.json(settings);
});

/* =========================
   BLOG POSTS
========================= */
router.get("/blog-posts", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.blogPosts.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  }

  const posts = await BlogPost.find().sort({ createdAt: -1 });
  res.json(posts);
});

router.post("/blog-posts", async (req, res) => {
  if (!isDbReady()) {
    const payload = { _id: makeId(), ...req.body, slug: slugify(req.body.slug || req.body.title), createdAt: new Date().toISOString() };
    memoryState.blogPosts.push(payload);
    return res.status(201).json(payload);
  }

  const payload = { ...req.body };
  payload.slug = payload.slug || slugify(payload.title);
  const post = await BlogPost.create(payload);
  res.status(201).json(post);
});

router.put("/blog-posts/:id", async (req, res) => {
  if (!isDbReady()) {
    const index = memoryState.blogPosts.findIndex((post) => post._id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Blog post not found." });
    memoryState.blogPosts[index] = { ...memoryState.blogPosts[index], ...req.body, slug: slugify(req.body.slug || req.body.title || memoryState.blogPosts[index].slug) };
    return res.json(memoryState.blogPosts[index]);
  }

  const payload = { ...req.body };
  if (payload.slug) payload.slug = slugify(payload.slug);
  const post = await BlogPost.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!post) return res.status(404).json({ message: "Blog post not found." });
  res.json(post);
});

router.delete("/blog-posts/:id", async (req, res) => {
  if (!isDbReady()) {
    memoryState.blogPosts = memoryState.blogPosts.filter((post) => post._id !== req.params.id);
    return res.json({ success: true });
  }

  await BlogPost.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   SUBSCRIBERS
========================= */
router.get("/subscribers", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.subscribers.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  }

  const subscribers = await Subscriber.find().sort({ createdAt: -1 });
  res.json(subscribers);
});

router.delete("/subscribers/:id", async (req, res) => {
  if (!isDbReady()) {
    memoryState.subscribers = memoryState.subscribers.filter((subscriber) => subscriber._id !== req.params.id);
    return res.json({ success: true });
  }

  await Subscriber.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   CONTACTS
========================= */
router.get("/contacts", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.contacts.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  }

  const contacts = await Contact.find().sort({ createdAt: -1 });
  res.json(contacts);
});

router.put("/contacts/:id", async (req, res) => {
  if (!isDbReady()) {
    const index = memoryState.contacts.findIndex((contact) => contact._id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Contact not found." });
    memoryState.contacts[index] = { ...memoryState.contacts[index], ...req.body };
    return res.json(memoryState.contacts[index]);
  }

  const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!contact) return res.status(404).json({ message: "Contact not found." });
  res.json(contact);
});

router.delete("/contacts/:id", async (req, res) => {
  if (!isDbReady()) {
    memoryState.contacts = memoryState.contacts.filter((contact) => contact._id !== req.params.id);
    return res.json({ success: true });
  }

  await Contact.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   PLANS
========================= */
router.get("/plans", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.plans.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))));
  }

  const plans = await Plan.find().sort({ createdAt: -1 });
  res.json(plans);
});

router.post("/plans", async (req, res) => {
  if (!isDbReady()) {
    const payload = { _id: makeId(), ...req.body, createdAt: new Date().toISOString() };
    memoryState.plans.push(payload);
    return res.status(201).json(payload);
  }

  const payload = { ...req.body };
  payload.slug = payload.slug || slugify(payload.name);
  const plan = await Plan.create(payload);
  res.status(201).json(plan);
});

router.put("/plans/:id", async (req, res) => {
  if (!isDbReady()) {
    const index = memoryState.plans.findIndex((plan) => plan._id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Plan not found." });
    memoryState.plans[index] = { ...memoryState.plans[index], ...req.body };
    return res.json(memoryState.plans[index]);
  }

  const payload = { ...req.body };
  if (payload.slug) payload.slug = slugify(payload.slug);
  const plan = await Plan.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!plan) return res.status(404).json({ message: "Plan not found." });
  res.json(plan);
});

router.delete("/plans/:id", async (req, res) => {
  if (!isDbReady()) {
    memoryState.plans = memoryState.plans.filter((plan) => plan._id !== req.params.id);
    return res.json({ success: true });
  }

  await Plan.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   PAYMENTS
========================= */
router.get("/payments", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.payments.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  }

  const payments = await Payment.find().sort({ createdAt: -1 });
  res.json(payments);
});

router.post("/payments", async (req, res) => {
  if (!isDbReady()) {
    const payload = { _id: makeId(), ...req.body, createdAt: new Date().toISOString() };
    memoryState.payments.push(payload);
    return res.status(201).json(payload);
  }

  const payment = await Payment.create(req.body);
  res.status(201).json(payment);
});

router.put("/payments/:id", async (req, res) => {
  if (!isDbReady()) {
    const index = memoryState.payments.findIndex((payment) => payment._id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Payment not found." });
    memoryState.payments[index] = { ...memoryState.payments[index], ...req.body };
    return res.json(memoryState.payments[index]);
  }

  const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  res.json(payment);
});

/* =========================
   API SUBSCRIPTIONS
========================= */
router.get("/api-subscriptions", async (req, res) => {
  if (!isDbReady()) {
    return res.json(memoryState.apiSubscriptions.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  }

  const subscriptions = await ApiSubscription.find().sort({ createdAt: -1 });
  res.json(subscriptions);
});

router.post("/api-subscriptions", async (req, res) => {
  if (!isDbReady()) {
    const payload = {
      _id: makeId(),
      apiKey: req.body.apiKey || makeId(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    memoryState.apiSubscriptions.push(payload);
    return res.status(201).json(payload);
  }

  const payload = { ...req.body, apiKey: req.body.apiKey || makeId() };
  const subscription = await ApiSubscription.create(payload);
  res.status(201).json(subscription);
});

router.put("/api-subscriptions/:id", async (req, res) => {
  if (!isDbReady()) {
    const index = memoryState.apiSubscriptions.findIndex((subscription) => subscription._id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "API subscription not found." });
    memoryState.apiSubscriptions[index] = { ...memoryState.apiSubscriptions[index], ...req.body, apiKey: req.body.apiKey || memoryState.apiSubscriptions[index].apiKey };
    return res.json(memoryState.apiSubscriptions[index]);
  }

  const payload = { ...req.body };
  if (!payload.apiKey) delete payload.apiKey;
  const subscription = await ApiSubscription.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!subscription) return res.status(404).json({ message: "API subscription not found." });
  res.json(subscription);
});

router.delete("/api-subscriptions/:id", async (req, res) => {
  if (!isDbReady()) {
    memoryState.apiSubscriptions = memoryState.apiSubscriptions.filter((subscription) => subscription._id !== req.params.id);
    return res.json({ success: true });
  }

  await ApiSubscription.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   REVENUE & SUBSCRIPTION OPERATIONS
========================= */
function monthStart() {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

async function stripeRequest(path, body) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? new URLSearchParams(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Stripe operation failed.");
  return data;
}

router.get("/revenue-summary", async (req, res) => {
  if (!isDbReady()) return res.json({ totalRevenue: 0, monthlyRevenue: 0, paidSubscribers: 0, transactions: 0, failedPayments: 0, refunds: 0, affiliateCommissions: 0, advertisingRevenue: 0, monthly: [] });
  const start = monthStart();
  const [total, monthly, paidSubscribers, transactions, failedPayments, refunds, monthlyRows] = await Promise.all([
    Payment.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, value: { $sum: "$amount" } } }]),
    Payment.aggregate([{ $match: { status: "paid", createdAt: { $gte: start } } }, { $group: { _id: null, value: { $sum: "$amount" } } }]),
    Subscription.countDocuments({ status: "active" }),
    Payment.countDocuments(),
    Payment.countDocuments({ status: "failed" }),
    Payment.countDocuments({ status: "refunded" }),
    Payment.aggregate([{ $match: { status: "paid" } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: "$amount" }, transactions: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 12 }])
  ]);
  res.json({ totalRevenue: total[0]?.value || 0, monthlyRevenue: monthly[0]?.value || 0, paidSubscribers, transactions, failedPayments, refunds, affiliateCommissions: 0, advertisingRevenue: 0, monthly: monthlyRows });
});

router.get("/payments/export", async (req, res) => {
  const payments = isDbReady() ? await Payment.find().sort({ createdAt: -1 }).lean() : memoryState.payments;
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [["createdAt", "customerEmail", "planSlug", "amount", "currency", "status", "reference"], ...payments.map((payment) => [payment.createdAt, payment.customerEmail, payment.planSlug, payment.amount, payment.currency, payment.status, payment.reference])];
  res.type("text/csv").attachment("transactions.csv").send(lines.map((line) => line.map(quote).join(",")).join("\n"));
});

router.post("/payments/:id/cancel", async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (payment.providerSubscriptionId) await stripeRequest(`subscriptions/${payment.providerSubscriptionId}`, { cancel_at_period_end: "true" });
  payment.cancelAtPeriodEnd = true;
  await payment.save();
  await Subscription.updateMany({ providerSubscriptionId: payment.providerSubscriptionId }, { $set: { cancelAtPeriodEnd: true } });
  res.json(payment);
});

router.post("/payments/:id/refund", async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (!payment.providerPaymentIntentId) return res.status(409).json({ message: "No refundable Stripe payment intent is available yet." });
  await stripeRequest("refunds", { payment_intent: payment.providerPaymentIntentId });
  payment.status = "refunded";
  payment.refundedAt = new Date();
  await payment.save();
  res.json(payment);
});

module.exports = router;
