const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Plan = require("../models/Plan");
const Payment = require("../models/Payment");
const ApiSubscription = require("../models/ApiSubscription");
const Referral = require("../models/Referral");
const DirectAdLead = require("../models/DirectAdLead");
const BusinessSettings = require("../models/BusinessSettings");
const { isPaypalConfigured, paypalRequest, amountString, currencyCode, getPaypalPlanId, verifyAmount } = require("../utils/paypal");
const { isFlutterwaveConfigured, flutterwaveRequest, verifyFlutterwaveAmount } = require("../utils/flutterwave");
const { fulfillGatewayPayment } = require("../utils/paymentFulfillment");

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
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.APP_BASE_URL);
}

function paymentProviders(plans = []) {
  const paypal = isPaypalConfigured();
  const stripe = isStripeConfigured();
  const flutterwaveMomo = isFlutterwaveConfigured() && plans.some((plan) =>
    (plan.interval || "monthly") === "one-time" && Number.isInteger(Number(plan.momoPriceRwf)) && Number(plan.momoPriceRwf) > 0
  );
  return { paypal, stripe, flutterwaveMomo };
}

function checkoutReturnUrl(status) {
  return `${process.env.APP_BASE_URL}/pricing.html?checkout=${status}&gateway=paypal`;
}

async function createPaypalOrder({ payment, plan }) {
  const currency = currencyCode(plan.currency);
  return paypalRequest("/v2/checkout/orders", {
    method: "POST",
    requestId: `sth-order-${payment._id}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: String(payment._id),
        custom_id: String(payment._id),
        invoice_id: `sth-${payment._id}`,
        description: `${plan.name} - Smart Tools Hub`,
        amount: { currency_code: currency, value: amountString(plan.price) }
      }],
      application_context: {
        brand_name: "Smart Tools Hub",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: checkoutReturnUrl("success"),
        cancel_url: checkoutReturnUrl("cancelled")
      }
    }
  });
}

async function createPaypalSubscription({ payment, plan, email }) {
  const paypalPlanId = await getPaypalPlanId(plan);
  return paypalRequest("/v1/billing/subscriptions", {
    method: "POST",
    requestId: `sth-subscription-${payment._id}`,
    body: {
      plan_id: paypalPlanId,
      custom_id: String(payment._id),
      subscriber: { email_address: email },
      application_context: {
        brand_name: "Smart Tools Hub",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: checkoutReturnUrl("success"),
        cancel_url: checkoutReturnUrl("cancelled")
      }
    }
  });
}

async function createFlutterwaveMomoCheckout({ payment, plan, email, phoneNumber }) {
  const result = await flutterwaveRequest("/charges?type=mobile_money_rwanda", {
    method: "POST",
    body: {
      tx_ref: payment.providerSessionId,
      order_id: payment.providerSessionId,
      amount: payment.amount,
      currency: "RWF",
      phone_number: phoneNumber,
      email,
      fullname: payment.customerName,
      meta: { payment_id: String(payment._id), plan_slug: plan.slug }
    }
  });
  return result;
}

function normalizeRwandaPhone(value) {
  let digits = String(value || "").trim().replace(/[\s()-]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("250")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^7\d{8}$/.test(digits)) return "";
  return `250${digits}`;
}

async function confirmFlutterwavePayment(payment, transactionId) {
  const result = await flutterwaveRequest(`/transactions/${encodeURIComponent(transactionId)}/verify`);
  const transaction = result.data || {};
  if (transaction.status !== "successful") return payment;
  if (transaction.tx_ref !== payment.providerSessionId ||
    String(transaction.currency || "").toUpperCase() !== "RWF" ||
    !verifyFlutterwaveAmount(transaction.amount, payment.amount)) {
    throw new Error("Flutterwave payment details did not match the pending MoMo payment.");
  }
  return fulfillGatewayPayment(payment, {
    captureId: String(transaction.id),
    customerId: String(transaction.customer?.id || ""),
    receiptNumber: String(transaction.flw_ref || transaction.id)
  });
}

async function capturePaypalOrder(payment) {
  let order;
  try {
    order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(payment.providerSessionId)}/capture`, {
      method: "POST",
      requestId: `sth-capture-${payment.providerSessionId}`,
      body: {}
    });
  } catch (error) {
    // A browser return and a webhook may try to finalize the same order at once.
    // Read the order after a capture conflict and only fulfill a completed order.
    try {
      order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(payment.providerSessionId)}`);
    } catch {
      throw error;
    }
    if (order.status !== "COMPLETED") return payment;
  }
  if (order.status !== "COMPLETED") return payment;
  const purchase = order.purchase_units?.[0];
  const capture = purchase?.payments?.captures?.find((item) => item.status === "COMPLETED");
  if (purchase?.custom_id !== String(payment._id) || !capture ||
    !verifyAmount(capture.amount, payment.amount, payment.currency)) {
    throw new Error("PayPal order details did not match the pending payment.");
  }
  return fulfillPaypalPayment(payment, { customerId: order.payer?.payer_id, captureId: capture.id });
}

async function confirmPaypalSubscription(payment, subscriptionId) {
  const subscription = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (subscription.id !== payment.providerSubscriptionId || subscription.custom_id !== String(payment._id)) {
    throw new Error("PayPal subscription details did not match the pending payment.");
  }
  const lastPayment = subscription.billing_info?.last_payment;
  if (subscription.status !== "ACTIVE" || !verifyAmount(lastPayment?.amount, payment.amount, payment.currency)) return payment;
  return fulfillPaypalPayment(payment, {
    customerId: subscription.subscriber?.payer_id,
    receiptNumber: subscription.id,
    currentPeriodStart: lastPayment.time ? new Date(lastPayment.time) : new Date(),
    currentPeriodEnd: subscription.billing_info?.next_billing_time ? new Date(subscription.billing_info.next_billing_time) : undefined
  });
}

async function createStripeCheckout({ payment, plan, email }) {
  const interval = plan.interval || "monthly";
  if (!["monthly", "yearly", "one-time"].includes(interval)) {
    throw new Error("This plan has an unsupported billing interval.");
  }
  const recurring = interval !== "one-time";
  const form = new URLSearchParams({
    mode: recurring ? "subscription" : "payment",
    customer_email: email,
    success_url: `${process.env.APP_BASE_URL}/pricing.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_BASE_URL}/pricing.html?checkout=cancelled`,
    "line_items[0][price_data][currency]": String(plan.currency || "USD").toLowerCase(),
    "line_items[0][price_data][product_data][name]": `${plan.name} — Smart Tools Hub`,
    "line_items[0][price_data][unit_amount]": String(Math.round(Number(plan.price) * 100)),
    "line_items[0][quantity]": "1",
    "metadata[paymentId]": String(payment._id),
    "metadata[planSlug]": plan.slug
  });
  if (recurring) {
    form.set("line_items[0][price_data][recurring][interval]", interval === "yearly" ? "year" : "month");
  }
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
      ? (await ensureDefaultPlans()) && (await Plan.find({ active: true }).select("-paypalProductId -paypalPlanId -paypalPlanAmount -paypalPlanCurrency -paypalPlanInterval").sort({ price: 1, name: 1 }))
      : defaultPlans();
    const settings = await getSettings();
    res.json({
      plans,
      settings: publicSettings(settings),
      paymentProviders: paymentProviders(plans)
    });
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
    if (!["monthly", "yearly", "one-time"].includes(plan.interval || "monthly")) {
      return res.status(400).json({ message: "This plan has an unsupported billing interval." });
    }
    const requestedGateway = String(req.body.gateway || "");
    if (!new Set(["stripe", "paypal", "flutterwave_momo"]).has(requestedGateway)) return res.status(400).json({ message: "Choose a supported checkout method." });
    const gateway = requestedGateway === "flutterwave_momo" ? "flutterwave" : requestedGateway;
    if (gateway !== "flutterwave" && Number(plan.price) <= 0) return res.status(400).json({ message: "The Free plan does not require checkout." });
    if (gateway === "stripe" && !isStripeConfigured()) return res.status(503).json({ message: "Stripe checkout is not configured." });
    if (gateway === "paypal" && !isPaypalConfigured()) return res.status(503).json({ message: "PayPal checkout needs API credentials and a registered webhook before it can accept payments." });
    if (gateway === "flutterwave" && !isFlutterwaveConfigured()) return res.status(503).json({ message: "Flutterwave MoMo checkout is not configured." });
    if (gateway === "flutterwave" && ((plan.interval || "monthly") !== "one-time" || !Number.isInteger(Number(plan.momoPriceRwf)) || !(Number(plan.momoPriceRwf) > 0))) {
      return res.status(400).json({ message: "Set a positive Rwanda MoMo price for this one-time plan in Admin → Plan Manager." });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    const momoPhoneNumber = gateway === "flutterwave" ? normalizeRwandaPhone(req.body.momoPhoneNumber) : "";
    if (gateway === "flutterwave" && !momoPhoneNumber) return res.status(400).json({ message: "Enter a valid Rwanda mobile number (for example, +250 78 123 4567)." });

    const pendingReference = `pending-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const payment = await Payment.create({
      customerName: String(req.body.name || "").trim(),
      customerEmail: email,
      planSlug: plan.slug,
      gateway,
      amount: gateway === "flutterwave" ? Number(plan.momoPriceRwf) : plan.price,
      currency: gateway === "flutterwave" ? "RWF" : plan.currency,
      status: "pending",
      reference: pendingReference,
      providerSessionId: gateway === "flutterwave" ? pendingReference : undefined
    });
    let checkoutUrl;
    try {
      if (gateway === "flutterwave") {
        const checkout = await createFlutterwaveMomoCheckout({ payment, plan, email, phoneNumber: momoPhoneNumber });
        payment.providerSessionId = checkout.data?.tx_ref || checkout.tx_ref || payment.reference;
        payment.reference = payment.providerSessionId;
        checkoutUrl = checkout.meta?.authorization?.redirect || checkout.data?.meta?.authorization?.redirect;
      } else if (gateway === "stripe") {
        const session = await createStripeCheckout({ payment, plan, email });
        payment.providerSessionId = session.id;
        payment.reference = session.id;
        checkoutUrl = session.url;
      } else if ((plan.interval || "monthly") === "one-time") {
        const order = await createPaypalOrder({ payment, plan });
        payment.providerSessionId = order.id;
        payment.reference = order.id;
        checkoutUrl = order.links?.find((link) => link.rel === "approve")?.href;
      } else {
        const subscription = await createPaypalSubscription({ payment, plan, email });
        payment.providerSessionId = subscription.id;
        payment.providerSubscriptionId = subscription.id;
        payment.reference = subscription.id;
        checkoutUrl = subscription.links?.find((link) => link.rel === "approve")?.href;
      }
      if (!checkoutUrl) throw new Error("The payment provider did not return an approval link.");
      await payment.save();
    } catch (error) {
      payment.status = "failed";
      payment.failedAt = new Date();
      await payment.save();
      throw error;
    }

    res.status(201).json({
      success: true,
      payment,
      checkoutUrl
    });
  } catch (err) {
    res.status(err.message?.includes("configured") ? 503 : 500).json({ message: err.message || "Failed to start checkout." });
  }
});

router.post("/api-subscriptions", async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: "API subscriptions are unavailable until the database is connected." });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const planSlug = slugify(req.body.planSlug || "free");
    const plan = await Plan.findOne({ slug: planSlug, active: true }) || { slug: "free", price: 0, apiLimit: 100 };
    if (Number(plan.price) > 0 || Number(plan.momoPriceRwf) > 0) {
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
    const paypalOrderId = String(req.query.token || req.query.paypal_order_id || "");
    const paypalSubscriptionId = String(req.query.subscription_id || req.query.paypal_subscription_id || "");
    const reference = String(req.query.session_id || "");
    const flutterwaveReference = String(req.query.tx_ref || "");
    const flutterwaveTransactionId = String(req.query.transaction_id || "");
    let payment;
    if (flutterwaveReference) {
      payment = await Payment.findOne({ gateway: "flutterwave", providerSessionId: flutterwaveReference });
      if (payment?.status === "pending" && flutterwaveTransactionId) {
        payment = await confirmFlutterwavePayment(payment, flutterwaveTransactionId);
      }
    } else if (paypalOrderId) {
      payment = await Payment.findOne({ gateway: "paypal", providerSessionId: paypalOrderId });
      if (payment?.status === "pending") payment = await capturePaypalOrder(payment);
    } else if (paypalSubscriptionId) {
      payment = await Payment.findOne({ gateway: "paypal", providerSubscriptionId: paypalSubscriptionId });
      if (payment?.status === "pending") payment = await confirmPaypalSubscription(payment, paypalSubscriptionId);
    } else {
      payment = await Payment.findOne({ gateway: "stripe", providerSessionId: reference });
    }
    if (!payment) return res.status(404).json({ message: "Checkout session not found." });
    if (payment.gateway === "paypal" && payment.status === "paid" && !payment.fulfilledAt) {
      payment = await fulfillPaypalPayment(payment);
    }
    const entitlementReference = payment.providerSessionId;
    const subscription = payment.status === "paid"
      ? await ApiSubscription.findOne({ paymentReference: entitlementReference })
      : null;
    res.json({ status: payment.status, planSlug: payment.planSlug, apiKey: subscription?.apiKey || null });
  } catch (err) {
    res.status(500).json({ message: "Failed to load checkout status." });
  }
});

router.post("/referrals", async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: "Referrals cannot be saved until the database is connected." });
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
      return res.status(503).json({ message: "Requests cannot be saved until the database is connected." });
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
