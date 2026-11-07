jest.mock("../utils/email", () => ({
  sendPaymentReceipt: jest.fn().mockResolvedValue(undefined)
}));

const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const ApiSubscription = require("../models/ApiSubscription");
const { sendPaymentReceipt } = require("../utils/email");
const stripeWebhook = require("../routes/stripeWebhook");

const app = express();
app.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

const webhookSecret = "test-webhook-secret";

function signatureFor(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

function postPayload(payload) {
  return request(app)
    .post("/webhook")
    .set("Stripe-Signature", signatureFor(payload))
    .send(payload.toString("utf8"))
    .set("Content-Type", "application/json");
}

describe("Stripe webhook", () => {
  let originalSecret;

  beforeEach(() => {
    originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sendPaymentReceipt.mockClear();
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  test("rejects invalid signatures and malformed signed payloads", async () => {
    await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .send(Buffer.from("{}"))
      .expect(400);

    await postPayload(Buffer.from("not-json"))
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe("Invalid webhook payload."));
  });

  test("acknowledges duplicate and unhandled events without mutating payments", async () => {
    jest.spyOn(Payment, "exists").mockResolvedValue(true);
    const paymentLookup = jest.spyOn(Payment, "findOne");
    const duplicate = await postPayload(Buffer.from(JSON.stringify({ id: "evt-duplicate", type: "charge.refunded" })));
    expect(duplicate.status).toBe(200);
    expect(paymentLookup).not.toHaveBeenCalled();

    Payment.exists.mockResolvedValue(false);
    const unhandled = await postPayload(Buffer.from(JSON.stringify({ id: "evt-unknown", type: "unknown.event" })));
    expect(unhandled.status).toBe(200);
    expect(unhandled.body.received).toBe(true);
  });

  test("fulfills completed checkout sessions and returns 404 for missing payments", async () => {
    jest.spyOn(Payment, "exists").mockResolvedValue(false);
    jest.spyOn(Payment, "findOne").mockResolvedValueOnce(null);
    const missingPayload = Buffer.from(JSON.stringify({
      id: "evt-missing",
      type: "checkout.session.completed",
      data: { object: { id: "session-missing" } }
    }));
    await postPayload(missingPayload).expect(404);

    const payment = {
      _id: "payment-1",
      planSlug: "pro",
      customerEmail: "customer@example.com",
      customerName: "Customer",
      processedEventIds: [],
      save: jest.fn().mockResolvedValue(undefined)
    };
    jest.spyOn(Payment, "findOne").mockResolvedValue(payment);
    jest.spyOn(Plan, "findOne").mockResolvedValue({ slug: "pro", active: true, apiLimit: 1000 });
    jest.spyOn(Subscription, "findOneAndUpdate").mockResolvedValue({
      _id: "subscription-1",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      status: "active",
      providerCustomerId: "cus-1",
      providerSubscriptionId: "sub-1"
    });
    jest.spyOn(User, "findOne").mockResolvedValue({
      _id: "user-1",
      save: jest.fn().mockResolvedValue(undefined)
    });
    jest.spyOn(Subscription, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(ApiSubscription, "findOneAndUpdate").mockResolvedValue({ apiKey: "sth_test-key" });

    const payload = Buffer.from(JSON.stringify({
      id: "evt-checkout",
      type: "checkout.session.completed",
      data: { object: { id: "session-1", customer: "cus-1", subscription: "sub-1", payment_intent: "pi-1" } }
    }));
    const response = await postPayload(payload).expect(200);

    expect(response.body.received).toBe(true);
    expect(payment.status).toBe("paid");
    expect(payment.processedEventIds).toContain("evt-checkout");
    expect(sendPaymentReceipt).toHaveBeenCalledWith(payment, "sth_test-key");
  });

  test("marks failed invoices and refunded charges on their payments", async () => {
    jest.spyOn(Payment, "exists").mockResolvedValue(false);
    const payment = {
      processedEventIds: [],
      save: jest.fn().mockResolvedValue(undefined)
    };
    jest.spyOn(Payment, "findOne").mockResolvedValue(payment);
    jest.spyOn(Subscription, "findOneAndUpdate").mockResolvedValue(null);

    await postPayload(Buffer.from(JSON.stringify({
      id: "evt-failed",
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub-1" } }
    }))).expect(200);
    expect(payment.status).toBe("failed");
    expect(payment.processedEventIds).toContain("evt-failed");

    await postPayload(Buffer.from(JSON.stringify({
      id: "evt-refund",
      type: "charge.refunded",
      data: { object: { payment_intent: "pi-1" } }
    }))).expect(200);
    expect(payment.status).toBe("refunded");
    expect(payment.processedEventIds).toContain("evt-refund");
  });

  test("updates subscriptions and pauses related API access", async () => {
    jest.spyOn(Payment, "exists").mockResolvedValue(false);
    jest.spyOn(Subscription, "findOneAndUpdate").mockResolvedValue({
      _id: "subscription-2",
      planSlug: "pro",
      customerEmail: "customer@example.com",
      userId: "user-2",
      currentPeriodEnd: new Date()
    });
    const apiUpdate = jest.spyOn(ApiSubscription, "updateMany").mockResolvedValue({ modifiedCount: 1 });
    const userUpdate = jest.spyOn(User, "updateOne").mockResolvedValue({ modifiedCount: 1 });

    await postPayload(Buffer.from(JSON.stringify({
      id: "evt-subscription",
      type: "customer.subscription.updated",
      data: { object: { id: "sub-2", status: "past_due", current_period_start: 100, current_period_end: 200 } }
    }))).expect(200);

    expect(apiUpdate).toHaveBeenCalledWith(
      { planSlug: "pro", ownerEmail: "customer@example.com" },
      { $set: { status: "paused" } }
    );
    expect(userUpdate).toHaveBeenCalled();
  });
});