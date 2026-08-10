const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Plan = require("../models/Plan");
const Payment = require("../models/Payment");
const ApiSubscription = require("../models/ApiSubscription");
const Referral = require("../models/Referral");
const DirectAdLead = require("../models/DirectAdLead");
const BusinessSettings = require("../models/BusinessSettings");

const router = express.Router();

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeApiKey() {
  return `sth_${crypto.randomBytes(18).toString("hex")}`;
}

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.APP_BASE_URL);
}

async function createStripeCheckout({ payment, plan, email }) {
  const form = new URLSearchParams({
    mode: "subscription",
    customer_email: email,
    success_url: `${process.env.APP_BASE_URL}/pricing.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_BASE_URL}/pricing.html?checkout=cancelled`,
    "line_items[0][price_data][currency]": String(plan.currency || "USD").toLowerCase(),
    "line_items[0][price_data][product_data][name]": `${plan.name} — Smart Tools Hub`,
    "line_items[0][price_data][unit_amount]": String(Math.round(Number(plan.price) * 100)),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][quantity]": "1",
    "metadata[paymentId]": String(payment._id),
    "metadata[planSlug]": plan.slug
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form
  });
  const session = await response.json();
  if (!response.ok) throw new Error(session.error?.message || "Stripe checkout could not be created.");
  return session;
}

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function defaultPlans() {
  return [
    {
      name: "Free",
      slug: "free",
      price: 0,
      interval: "free",
      dailyLimit: 25,
      apiLimit: 100,
      features: ["Ads shown", "Daily usage limits", "Basic tool access"]
    },
    {
      name: "Pro",
      slug: "pro",
      price: 9,
      interval: "monthly",
      dailyLimit: 1000,
      apiLimit: 10000,
      adsRemoved: true,
      features: ["No ads", "Faster processing", "Extra features", "API access"]
    },
    {
      name: "API Business",
      slug: "api-business",
      price: 29,
      interval: "monthly",
      dailyLimit: 5000,
      apiLimit: 100000,
      adsRemoved: true,
      features: ["Higher API limits", "Commercial usage", "Priority endpoint support", "Usage reports"]
    },
    {
      name: "White Label",
      slug: "white-label",
      price: 99,
      interval: "monthly",
      dailyLimit: 20000,
      apiLimit: 250000,
      adsRemoved: true,
      features: ["Tools under your brand", "Direct implementation support", "Sponsored placement options", "Custom domain ready"]
    }
  ];
}

async function ensureDefaultPlans() {
  if (!isDbReady()) return defaultPlans();

  const defaults = defaultPlans();

  await Plan.bulkWrite(defaults.map((plan) => ({
    updateOne: {
      filter: { slug: plan.slug },
      update: { $setOnInsert: plan },
      upsert: true
    }
  })));

  return defaults;
}

async function getSettings() {
  if (!isDbReady()) {
    return {
      key: "default",
      brandName: "Smart Tools Hub",
      logoUrl: "",
      defaultCurrency: "USD",
      paypalUrl: "",
      stripeUrl: "",
      flutterwaveUrl: "",
      paystackUrl: "",
      adsensePublisherId: "",
      propellerAdsCode: "",
      adsterraCode: "",
      supportedLanguages: ["en"],
      socialLinks: {
        facebook: "",
        linkedin: "",
        youtube: ""
      }
    };
  }

  return BusinessSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { upsert: true, new: true }
  );
}

function publicSettings(settings) {
  const safeSettings = settings || {
    brandName: "Smart Tools Hub",
    logoUrl: "",
    defaultCurrency: "USD",
    paypalUrl: "",
    stripeUrl: "",
    flutterwaveUrl: "",
    paystackUrl: "",
    adsensePublisherId: "",
    propellerAdsCode: "",
    adsterraCode: "",
    supportedLanguages: ["en"],
    socialLinks: {
      facebook: "",
      linkedin: "",
      youtube: ""
    }
  };

  return {
    brandName: safeSettings.brandName,
    logoUrl: safeSettings.logoUrl,
    defaultCurrency: safeSettings.defaultCurrency,
    paypalUrl: safeSettings.paypalUrl,
    stripeUrl: safeSettings.stripeUrl,
    flutterwaveUrl: safeSettings.flutterwaveUrl,
    paystackUrl: safeSettings.paystackUrl,
    adsensePublisherId: safeSettings.adsensePublisherId,
    propellerAdsCode: safeSettings.propellerAdsCode,
    adsterraCode: safeSettings.adsterraCode,
    supportedLanguages: safeSettings.supportedLanguages,
    socialLinks: safeSettings.socialLinks
  };
}

router.get("/plans", async (req, res) => {
  try {
    const plans = isDbReady()
      ? (await ensureDefaultPlans()) && (await Plan.find({ active: true }).sort({ price: 1, name: 1 }))
      : defaultPlans();
    const settings = await getSettings();
    res.json({ plans, settings: publicSettings(settings) });
  } catch (err) {
    res.status(500).json({ message: "Failed to load plans." });
  }
});

router.get("/settings", async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(publicSettings(settings));
  } catch (err) {
    res.status(500).json({ message: "Failed to load business settings." });
  }
});

router.post("/checkout-interest", async (req, res) => {
  try {
    if (!isDbReady()) return res.status(503).json({ message: "Checkout is unavailable until the database is connected." });

    const plan = await Plan.findOne({ slug: slugify(req.body.planSlug), active: true });
    if (!plan) return res.status(404).json({ message: "Plan not found." });
    if (plan.price <= 0) return res.status(400).json({ message: "The Free plan does not require checkout." });
    if (req.body.gateway !== "stripe") return res.status(400).json({ message: "Stripe is the supported production checkout gateway." });
    if (!isStripeConfigured()) return res.status(503).json({ message: "Stripe checkout is not configured." });

    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });

    const payment = await Payment.create({
      customerName: String(req.body.name || "").trim(),
      customerEmail: email,
      planSlug: plan.slug,
      gateway: "stripe",
      amount: plan.price,
      currency: plan.currency,
      status: "pending",
      reference: `pending-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`
    });
    const session = await createStripeCheckout({ payment, plan, email });
    payment.providerSessionId = session.id;
    payment.reference = session.id;
    await payment.save();

    res.status(201).json({
      success: true,
      payment,
      checkoutUrl: session.url
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to start checkout." });
  }
});

router.post("/api-subscriptions", async (req, res) => {
  try {
    if (!isDbReady()) {
      const email = String(req.body.email || "").trim().toLowerCase();
      return res.status(201).json({
        success: true,
        subscription: {
          ownerName: String(req.body.name || "").trim(),
          ownerEmail: email,
          planSlug: slugify(req.body.planSlug || "free"),
          dailyLimit: 100,
          apiKey: makeApiKey(),
          status: "active"
        }
      });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const planSlug = slugify(req.body.planSlug || "free");
    const plan = await Plan.findOne({ slug: planSlug, active: true }) || { slug: "free", price: 0, apiLimit: 100 };
    if (Number(plan.price) > 0) {
      return res.status(409).json({
        message: "A paid API plan requires checkout.",
        requiresCheckout: true,
        planSlug: plan.slug
      });
    }
    const subscription = await ApiSubscription.create({
      ownerName: String(req.body.name || "").trim(),
      ownerEmail: email,
      planSlug,
      dailyLimit: plan.apiLimit || 100,
      apiKey: makeApiKey()
    });

    res.status(201).json({ success: true, subscription });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "An API key already exists for this generated key. Try again." });
    res.status(500).json({ message: "Failed to create API subscription." });
  }
});

router.get("/checkout-result", async (req, res) => {
  try {
    const reference = String(req.query.session_id || "");
    const payment = await Payment.findOne({ providerSessionId: reference });
    if (!payment) return res.status(404).json({ message: "Checkout session not found." });
    const subscription = payment.status === "paid"
      ? await ApiSubscription.findOne({ paymentReference: reference })
      : null;
    res.json({ status: payment.status, planSlug: payment.planSlug, apiKey: subscription?.apiKey || null });
  } catch (err) {
    res.status(500).json({ message: "Failed to load checkout status." });
  }
});

router.post("/referrals", async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(201).json({ success: true, referral: { referrerEmail: String(req.body.referrerEmail || "").trim().toLowerCase(), invitedEmail: String(req.body.invitedEmail || "").trim().toLowerCase() } });
    }

    const referrerEmail = String(req.body.referrerEmail || "").trim().toLowerCase();
    const invitedEmail = String(req.body.invitedEmail || "").trim().toLowerCase();
    if (!referrerEmail || !invitedEmail) return res.status(400).json({ message: "Both emails are required." });

    const referral = await Referral.create({ referrerEmail, invitedEmail });
    res.status(201).json({ success: true, referral });
  } catch (err) {
    res.status(500).json({ message: "Failed to save referral." });
  }
});

router.post("/advertise", async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(201).json({ success: true, lead: { company: String(req.body.company || "").trim(), name: String(req.body.name || "").trim(), email: String(req.body.email || "").trim().toLowerCase(), placement: String(req.body.placement || "").trim(), budget: Number(req.body.budget || 0), message: String(req.body.message || "").trim() } });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid business email." });
    }

    const lead = await DirectAdLead.create({
      company: String(req.body.company || "").trim(),
      name: String(req.body.name || "").trim(),
      email,
      placement: String(req.body.placement || "").trim(),
      budget: Number(req.body.budget || 0),
      message: String(req.body.message || "").trim()
    });

    res.status(201).json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ message: "Failed to save advertising request." });
  }
});

router.post("/v1/bmi", async (req, res) => {
  try {
    if (!isDbReady()) {
      const weightKg = Number(req.body.weightKg);
      const heightCm = Number(req.body.heightCm);
      if (!weightKg || !heightCm) return res.status(400).json({ message: "weightKg and heightCm are required." });
      const heightM = heightCm / 100;
      const bmi = Number((weightKg / (heightM * heightM)).toFixed(2));
      return res.json({ bmi });
    }

    const apiKey = req.get("x-api-key");
    const subscription = await ApiSubscription.findOne({ apiKey, status: "active" });
    if (!subscription) return res.status(401).json({ message: "Valid API key required." });
    if (subscription.usedToday >= subscription.dailyLimit) {
      return res.status(429).json({ message: "Daily API limit reached." });
    }

    const weightKg = Number(req.body.weightKg);
    const heightCm = Number(req.body.heightCm);
    if (!weightKg || !heightCm) return res.status(400).json({ message: "weightKg and heightCm are required." });

    const heightM = heightCm / 100;
    const bmi = Number((weightKg / (heightM * heightM)).toFixed(2));
    await ApiSubscription.updateOne(
      { _id: subscription._id },
      { $inc: { usedToday: 1 }, $set: { lastUsedAt: new Date() } }
    );

    res.json({ bmi });
  } catch (err) {
    res.status(500).json({ message: "BMI API failed." });
  }
});

module.exports = router;
