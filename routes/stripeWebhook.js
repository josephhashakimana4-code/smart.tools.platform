const crypto = require("crypto");
const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const ApiSubscription = require("../models/ApiSubscription");
const { sendPaymentReceipt } = require("../utils/email");

function makeApiKey() { return `sth_${crypto.randomBytes(18).toString("hex")}`; }

function signatureMatches(payload, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const pairs = signature.split(",").map((part) => part.split("=", 2));
  const timestamp = pairs.find(([key]) => key === "t")?.[1];
  const signatures = pairs.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some((value) => {
    const actual = Buffer.from(value, "hex");
    const target = Buffer.from(expected, "hex");
    return actual.length === target.length && crypto.timingSafeEqual(actual, target);
  });
}

function stripeTime(value) { return value ? new Date(value * 1000) : undefined; }

async function activateEntitlement(payment, subscriptionData = {}) {
  const plan = await Plan.findOne({ slug: payment.planSlug, active: true });
  if (!plan) return;
  const reference = payment.providerSessionId;
  const subscription = await Subscription.findOneAndUpdate(
    { paymentReference: reference },
    { $set: {
      customerEmail: payment.customerEmail,
      planSlug: plan.slug,
      status: subscriptionData.status || "active",
      providerCustomerId: subscriptionData.customer || payment.providerCustomerId,
      providerSubscriptionId: subscriptionData.id || payment.providerSubscriptionId,
      currentPeriodStart: stripeTime(subscriptionData.current_period_start) || payment.currentPeriodStart,
      currentPeriodEnd: stripeTime(subscriptionData.current_period_end) || payment.currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(subscriptionData.cancel_at_period_end)
    }, $setOnInsert: { paymentReference: reference } },
    { upsert: true, new: true }
  );
  const user = await User.findOne({ email: payment.customerEmail });
  if (user) {
    user.plan = plan.slug;
    user.planStartDate = subscription.currentPeriodStart || new Date();
    user.planEndDate = subscription.currentPeriodEnd;
    user.subscriptionStatus = subscription.status;
    user.stripeCustomerId = subscription.providerCustomerId;
    user.stripeSubscriptionId = subscription.providerSubscriptionId;
    await user.save();
    await Subscription.updateOne({ _id: subscription._id }, { $set: { userId: user._id } });
  }
  if (Number(plan.apiLimit) > 0) {
    const apiSubscription = await ApiSubscription.findOneAndUpdate(
      { paymentReference: reference },
      { $set: { ownerName: payment.customerName, ownerEmail: payment.customerEmail, planSlug: plan.slug, dailyLimit: plan.apiLimit, status: "active" },
        $setOnInsert: { apiKey: makeApiKey(), paymentReference: reference } },
      { upsert: true, new: true }
    );
    return apiSubscription?.apiKey;
  }
  return null;
}

async function updateSubscriptionState(providerSubscriptionId, status, eventData) {
  const subscription = await Subscription.findOneAndUpdate(
    { providerSubscriptionId },
    { $set: { status, currentPeriodStart: stripeTime(eventData.current_period_start), currentPeriodEnd: stripeTime(eventData.current_period_end), cancelAtPeriodEnd: Boolean(eventData.cancel_at_period_end), cancelledAt: status === "cancelled" ? new Date() : undefined } },
    { new: true }
  );
  if (!subscription) return;
  await ApiSubscription.updateMany({ planSlug: subscription.planSlug, ownerEmail: subscription.customerEmail }, { $set: { status: status === "active" ? "active" : "paused" } });
  if (subscription.userId) await User.updateOne({ _id: subscription.userId }, { $set: { subscriptionStatus: status, planEndDate: subscription.currentPeriodEnd } });
}

async function stripeWebhook(req, res) {
  const payload = req.body;
  if (!Buffer.isBuffer(payload) || !signatureMatches(payload, req.get("stripe-signature"))) return res.status(400).json({ message: "Invalid Stripe webhook signature." });
  let event;
  try { event = JSON.parse(payload.toString("utf8")); } catch { return res.status(400).json({ message: "Invalid webhook payload." }); }
  const data = event.data?.object || {};
  try {
    const eventExists = await Payment.exists({ processedEventIds: event.id });
    if (eventExists) return res.json({ received: true });
    let payment;
    if (event.type === "checkout.session.completed") {
      payment = await Payment.findOne({ providerSessionId: data.id });
      if (!payment) return res.status(404).json({ message: "Payment record not found." });
      payment.status = "paid";
      payment.providerCustomerId = data.customer || "";
      payment.providerSubscriptionId = data.subscription || "";
      payment.providerPaymentIntentId = data.payment_intent || "";
      payment.receiptNumber = data.payment_intent || data.id;
      payment.fulfilledAt = new Date();
      payment.processedEventIds.push(event.id);
      await payment.save();
      const apiKey = await activateEntitlement(payment);
      await sendPaymentReceipt(payment, apiKey).catch(() => {});
    } else if (event.type === "invoice.paid") {
      payment = await Payment.findOne({ providerSubscriptionId: data.subscription });
      if (payment) {
        payment.status = "paid";
        payment.latestInvoiceId = data.id;
        payment.providerPaymentIntentId = data.payment_intent || payment.providerPaymentIntentId;
        payment.currentPeriodStart = stripeTime(data.period_start);
        payment.currentPeriodEnd = stripeTime(data.period_end);
        payment.processedEventIds.push(event.id);
        await payment.save();
        await activateEntitlement(payment, { id: data.subscription, customer: data.customer, current_period_start: data.period_start, current_period_end: data.period_end });
      }
    } else if (event.type === "invoice.payment_failed") {
      payment = await Payment.findOne({ providerSubscriptionId: data.subscription });
      if (payment) { payment.status = "failed"; payment.failedAt = new Date(); payment.processedEventIds.push(event.id); await payment.save(); }
      await updateSubscriptionState(data.subscription, "past_due", data);
    } else if (event.type === "customer.subscription.updated") {
      await updateSubscriptionState(data.id, data.status === "active" ? "active" : "past_due", data);
    } else if (event.type === "customer.subscription.deleted") {
      await updateSubscriptionState(data.id, "cancelled", data);
    } else if (event.type === "charge.refunded") {
      payment = await Payment.findOne({ providerPaymentIntentId: data.payment_intent });
      if (payment) { payment.status = "refunded"; payment.refundedAt = new Date(); payment.processedEventIds.push(event.id); await payment.save(); }
    }
    return res.json({ received: true });
  } catch (error) { return res.status(500).json({ message: "Unable to process Stripe event." }); }
}

module.exports = stripeWebhook;
