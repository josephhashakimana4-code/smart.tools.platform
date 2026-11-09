const crypto = require("crypto");
const Plan = require("../models/Plan");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const ApiSubscription = require("../models/ApiSubscription");
const Payment = require("../models/Payment");
const { sendPaymentReceipt } = require("./email");

function makeApiKey() { return `sth_${crypto.randomBytes(18).toString("hex")}`; }

function asDate(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function activateEntitlement(payment, subscriptionData = {}) {
  const plan = await Plan.findOne({ slug: payment.planSlug, active: true });
  if (!plan) return null;
  const reference = payment.providerSessionId;
  let subscription;
  try {
    subscription = await Subscription.findOneAndUpdate(
      { paymentReference: reference },
      { $set: {
        customerEmail: payment.customerEmail,
        planSlug: plan.slug,
        provider: payment.gateway || "stripe",
        status: subscriptionData.status || "active",
        providerCustomerId: subscriptionData.customer || payment.providerCustomerId,
        providerSubscriptionId: subscriptionData.id || payment.providerSubscriptionId,
        currentPeriodStart: asDate(subscriptionData.currentPeriodStart || subscriptionData.current_period_start) || payment.currentPeriodStart,
        currentPeriodEnd: asDate(subscriptionData.currentPeriodEnd || subscriptionData.current_period_end) || payment.currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(subscriptionData.cancel_at_period_end)
      }, $setOnInsert: { paymentReference: reference } },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    subscription = await Subscription.findOne({ paymentReference: reference });
    if (!subscription) throw error;
  }
  const user = await User.findOne({ email: payment.customerEmail });
  if (user) {
    user.plan = plan.slug;
    user.planStartDate = subscription.currentPeriodStart || new Date();
    user.planEndDate = subscription.currentPeriodEnd;
    user.subscriptionStatus = subscription.status;
    if ((payment.gateway || "stripe") === "stripe") {
      user.stripeCustomerId = subscription.providerCustomerId;
      user.stripeSubscriptionId = subscription.providerSubscriptionId;
    }
    await user.save();
    await Subscription.updateOne({ _id: subscription._id }, { $set: { userId: user._id } });
  }
  if (Number(plan.apiLimit) > 0) {
    try {
      const apiSubscription = await ApiSubscription.findOneAndUpdate(
        { paymentReference: reference },
        { $set: { ownerName: payment.customerName, ownerEmail: payment.customerEmail, planSlug: plan.slug, dailyLimit: plan.apiLimit, status: "active" },
          $setOnInsert: { apiKey: makeApiKey(), paymentReference: reference } },
        { upsert: true, new: true }
      );
      return apiSubscription?.apiKey || null;
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await ApiSubscription.findOne({ paymentReference: reference });
      if (!existing) throw error;
      return existing.apiKey || null;
    }
  }
  return null;
}

async function fulfillGatewayPayment(payment, details = {}, eventId) {
  const paid = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "pending" },
    { $set: {
      status: "paid",
      providerCustomerId: details.customerId || payment.providerCustomerId,
      providerPaymentIntentId: details.captureId || payment.providerPaymentIntentId,
      latestInvoiceId: details.invoiceId || payment.latestInvoiceId,
      receiptNumber: details.captureId || details.receiptNumber || details.invoiceId || payment.receiptNumber,
      currentPeriodStart: details.currentPeriodStart || payment.currentPeriodStart,
      currentPeriodEnd: details.currentPeriodEnd || payment.currentPeriodEnd
    } },
    { new: true }
  );
  const current = paid || await Payment.findById(payment._id);
  if (!current || current.status !== "paid") return current;

  let apiKey = null;
  if (!current.fulfilledAt) {
    apiKey = await activateEntitlement(current, {
      id: current.providerSubscriptionId,
      customer: current.providerCustomerId,
      currentPeriodStart: current.currentPeriodStart,
      currentPeriodEnd: current.currentPeriodEnd
    });
    const update = await Payment.updateOne(
      { _id: current._id, status: "paid", fulfilledAt: { $exists: false } },
      { $set: { fulfilledAt: new Date() } }
    );
    if (update.modifiedCount) await sendPaymentReceipt(current, apiKey).catch(() => {});
  }
  if (eventId) await Payment.updateOne({ _id: current._id }, { $addToSet: { processedEventIds: eventId } });
  return Payment.findById(current._id);
}

module.exports = { activateEntitlement, fulfillGatewayPayment, fulfillPaypalPayment: fulfillGatewayPayment };
