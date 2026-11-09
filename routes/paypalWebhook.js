const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const ApiSubscription = require("../models/ApiSubscription");
const { isPaypalConfigured, paypalRequest, verifyAmount } = require("../utils/paypal");
const { fulfillPaypalPayment } = require("../utils/paymentFulfillment");

async function verifyPaypalWebhook(event, headers) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return false;
  const result = await paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event
    }
  });
  return result.verification_status === "SUCCESS";
}

async function markFirstSubscriptionPayment(payment, eventId) {
  const subscription = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(payment.providerSubscriptionId)}`);
  const lastPayment = subscription.billing_info?.last_payment;
  if (subscription.status !== "ACTIVE" || subscription.custom_id !== String(payment._id) ||
    !verifyAmount(lastPayment?.amount, payment.amount, payment.currency)) return;
  return fulfillPaypalPayment(payment, {
    customerId: subscription.subscriber?.payer_id,
    receiptNumber: subscription.id,
    currentPeriodStart: lastPayment.time ? new Date(lastPayment.time) : new Date(),
    currentPeriodEnd: subscription.billing_info?.next_billing_time ? new Date(subscription.billing_info.next_billing_time) : undefined
  }, eventId);
}

async function markCompletedOrder(payment, eventId) {
  const order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(payment.providerSessionId)}`);
  const purchase = order.purchase_units?.[0];
  const capture = purchase?.payments?.captures?.find((item) => item.status === "COMPLETED");
  if (order.status !== "COMPLETED" || purchase?.custom_id !== String(payment._id) || !capture ||
    !verifyAmount(capture.amount, payment.amount, payment.currency)) return;
  return fulfillPaypalPayment(payment, { customerId: order.payer?.payer_id, captureId: capture.id }, eventId);
}

async function recordSubscriptionSale(event) {
  const sale = event.resource || {};
  const subscriptionId = sale.billing_agreement_id || sale.supplementary_data?.related_ids?.billing_agreement_id;
  let initial = subscriptionId
    ? await Payment.findOne({ gateway: "paypal", providerSubscriptionId: subscriptionId, status: { $in: ["paid", "pending"] } }).sort({ createdAt: 1 })
    : null;
  if (!initial) return;
  if (initial.status === "pending") {
    await markFirstSubscriptionPayment(initial, event.id);
    initial = await Payment.findById(initial._id);
  }
  if (initial?.status !== "paid" || !verifyAmount(sale.amount, initial.amount, initial.currency)) return;

  const reference = sale.id || event.id;
  if (await Payment.exists({ gateway: "paypal", reference })) return;
  const saleDate = sale.create_time ? new Date(sale.create_time) : null;
  if (saleDate && initial.createdAt && Math.abs(saleDate.getTime() - initial.createdAt.getTime()) < 24 * 60 * 60 * 1000) {
    await Payment.updateOne({ _id: initial._id }, { $set: { latestInvoiceId: sale.id }, $addToSet: { processedEventIds: event.id } });
    return;
  }
  const renewal = await Payment.create({
    customerName: initial.customerName,
    customerEmail: initial.customerEmail,
    planSlug: initial.planSlug,
    gateway: "paypal",
    amount: initial.amount,
    currency: initial.currency,
    status: "paid",
    reference,
    providerSubscriptionId: subscriptionId,
    providerCustomerId: initial.providerCustomerId,
    providerPaymentIntentId: sale.id,
    providerEventId: event.id,
    latestInvoiceId: sale.id,
    receiptNumber: sale.id,
    processedEventIds: [event.id],
    createdAt: sale.create_time ? new Date(sale.create_time) : new Date(),
    fulfilledAt: new Date()
  });
  const remote = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`).catch(() => null);
  const nextBillingTime = remote?.billing_info?.next_billing_time;
  const currentPeriodStart = sale.create_time ? new Date(sale.create_time) : new Date();
  const currentPeriodEnd = nextBillingTime ? new Date(nextBillingTime) : undefined;
  await Subscription.updateOne({ providerSubscriptionId: subscriptionId }, { $set: {
    status: "active", currentPeriodStart, ...(currentPeriodEnd ? { currentPeriodEnd } : {})
  } });
  await User.updateMany({ email: renewal.customerEmail }, { $set: { subscriptionStatus: "active", planEndDate: currentPeriodEnd } });
  await ApiSubscription.updateMany({ ownerEmail: renewal.customerEmail, planSlug: renewal.planSlug }, { $set: { status: "active" } });
}

async function updateSubscriptionState(subscriptionId, status, eventId) {
  const payment = await Payment.findOne({ gateway: "paypal", providerSubscriptionId: subscriptionId }).sort({ createdAt: 1 });
  if (!payment) return;
  await Payment.updateOne({ _id: payment._id }, { $addToSet: { processedEventIds: eventId } });
  const state = status === "CANCELLED" ? "cancelled" : "past_due";
  const subscription = await Subscription.findOneAndUpdate(
    { providerSubscriptionId: subscriptionId },
    { $set: { status: state, cancelledAt: state === "cancelled" ? new Date() : undefined, cancelAtPeriodEnd: false } },
    { new: true }
  );
  if (!subscription) return;
  await ApiSubscription.updateMany({ ownerEmail: subscription.customerEmail, planSlug: subscription.planSlug }, { $set: { status: "paused" } });
  if (subscription.userId) await User.updateOne({ _id: subscription.userId }, { $set: { subscriptionStatus: state, planEndDate: subscription.currentPeriodEnd } });
}

async function paypalWebhook(req, res) {
  if (!isPaypalConfigured()) return res.status(503).json({ message: "PayPal webhook verification is not configured." });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ message: "Invalid PayPal webhook payload." });
  let event;
  try { event = JSON.parse(req.body.toString("utf8")); } catch { return res.status(400).json({ message: "Invalid PayPal webhook payload." }); }
  if (!event.id || !event.event_type) return res.status(400).json({ message: "Invalid PayPal webhook event." });

  try {
    if (!await verifyPaypalWebhook(event, req.headers)) return res.status(400).json({ message: "Invalid PayPal webhook signature." });
    if (await Payment.exists({ processedEventIds: event.id })) return res.json({ received: true });
    const resource = event.resource || {};

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = resource.supplementary_data?.related_ids?.order_id;
      const payment = orderId ? await Payment.findOne({ gateway: "paypal", providerSessionId: orderId }) : null;
      if (payment?.status === "pending") await markCompletedOrder(payment, event.id);
    } else if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const payment = await Payment.findOne({ gateway: "paypal", providerSubscriptionId: resource.id });
      if (payment?.status === "pending") await markFirstSubscriptionPayment(payment, event.id);
    } else if (event.event_type === "PAYMENT.SALE.COMPLETED") {
      await recordSubscriptionSale(event);
    } else if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      const payment = await Payment.findOne({ gateway: "paypal", providerPaymentIntentId: resource.id });
      const totalRefunded = resource.seller_receivable_breakdown?.total_refunded_amount;
      if (payment && (resource.status === "REFUNDED" || verifyAmount(totalRefunded, payment.amount, payment.currency))) {
        payment.status = "refunded";
        payment.refundedAt = new Date();
        if (!payment.processedEventIds.includes(event.id)) payment.processedEventIds.push(event.id);
        await payment.save();
      }
    } else if (event.event_type === "PAYMENT.SALE.REFUNDED") {
      const saleId = resource.id;
      const payment = await Payment.findOne({ gateway: "paypal", $or: [{ providerPaymentIntentId: saleId }, { latestInvoiceId: saleId }] });
      if (payment && (resource.state === "refunded" || resource.state === "REFUNDED")) {
        payment.status = "refunded";
        payment.refundedAt = new Date();
        if (!payment.processedEventIds.includes(event.id)) payment.processedEventIds.push(event.id);
        await payment.save();
      }
    } else if (event.event_type === "PAYMENT.SALE.DENIED") {
      const subscriptionId = resource.billing_agreement_id;
      const payment = subscriptionId ? await Payment.findOne({ gateway: "paypal", providerSubscriptionId: subscriptionId, status: { $in: ["pending", "paid"] } }).sort({ createdAt: 1 }) : null;
      if (payment) {
        let failed;
        if (payment.status === "pending") {
          failed = await Payment.findOneAndUpdate({ _id: payment._id, status: "pending" }, {
            $set: { status: "failed", failedAt: new Date(), providerPaymentIntentId: resource.id, providerEventId: event.id },
            $addToSet: { processedEventIds: event.id }
          }, { new: true });
        } else {
          failed = await Payment.create({
            customerName: payment.customerName, customerEmail: payment.customerEmail, planSlug: payment.planSlug,
            gateway: "paypal", amount: payment.amount, currency: payment.currency, status: "failed",
            reference: resource.id || event.id, providerSubscriptionId: subscriptionId,
            providerCustomerId: payment.providerCustomerId, providerPaymentIntentId: resource.id,
            processedEventIds: [event.id], providerEventId: event.id, failedAt: new Date()
          });
        }
        await updateSubscriptionState(subscriptionId, "SUSPENDED", event.id);
        return res.json({ received: true, paymentId: failed?._id });
      }
    } else if (["BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED", "BILLING.SUBSCRIPTION.PAYMENT.FAILED"].includes(event.event_type)) {
      const subscriptionId = resource.id || resource.billing_agreement_id;
      await updateSubscriptionState(subscriptionId, event.event_type.endsWith("CANCELLED") ? "CANCELLED" : "SUSPENDED", event.id);
    }
    return res.json({ received: true });
  } catch (error) {
    return res.status(500).json({ message: "Unable to process PayPal webhook." });
  }
}

module.exports = paypalWebhook;
