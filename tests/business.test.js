const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const Plan = require("../models/Plan");
const Payment = require("../models/Payment");
const ApiSubscription = require("../models/ApiSubscription");
const Referral = require("../models/Referral");
const DirectAdLead = require("../models/DirectAdLead");
const BusinessSettings = require("../models/BusinessSettings");
const businessRouter = require("../routes/business");

const app = express();
app.use(express.json());
app.use("/api/business", businessRouter);

describe("Business routes without a database", () => {
  let readyState;
  let originalStripeSecret;
  let originalAppBaseUrl;

  beforeEach(() => {
    readyState = mongoose.connection.readyState;
    originalStripeSecret = process.env.STRIPE_SECRET_KEY;
    originalAppBaseUrl = process.env.APP_BASE_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mongoose.connection.readyState = readyState;
    if (originalStripeSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeSecret;
    if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalAppBaseUrl;
  });

  test("returns public plans and settings and blocks checkout while disconnected", async () => {
    const plansResponse = await request(app).get("/api/business/plans").expect(200);
    expect(plansResponse.body.plans.map((plan) => plan.slug)).toContain("pro");
    expect(plansResponse.body.settings).not.toHaveProperty("key");

    const settingsResponse = await request(app).get("/api/business/settings").expect(200);
    expect(settingsResponse.body.brandName).toBe("Smart Tools Hub");

    await request(app)
      .post("/api/business/checkout-interest")
      .send({ planSlug: "pro", gateway: "stripe", email: "customer@example.com" })
      .expect(503);
  });

  test("does not claim API subscriptions, referrals, or advertising requests were saved while disconnected", async () => {
    const subscriptionResponse = await request(app)
      .post("/api/business/api-subscriptions")
      .send({ name: " API Customer ", email: "CUSTOMER@example.com", planSlug: "API Business" })
      .expect(503);
    expect(subscriptionResponse.body).not.toHaveProperty("subscription.apiKey");

    const referralResponse = await request(app)
      .post("/api/business/referrals")
      .send({ referrerEmail: " REFERRER@example.com ", invitedEmail: " INVITED@example.com " })
      .expect(503);
    expect(referralResponse.body.message).toMatch(/database is connected/i);

    const leadResponse = await request(app)
      .post("/api/business/advertise")
      .send({ company: " Example Co ", email: " SALES@example.com ", budget: "250" })
      .expect(503);
    expect(leadResponse.body.message).toMatch(/database is connected/i);
  });

  test("validates and calculates BMI through the fallback API", async () => {
    await request(app)
      .post("/api/business/v1/bmi")
      .send({ weightKg: 80 })
      .expect(400);

    const response = await request(app)
      .post("/api/business/v1/bmi")
      .send({ weightKg: 80, heightCm: 180 })
      .expect(200);
    expect(response.body.bmi).toBe(24.69);
  });

  test("returns not found for an unknown checkout session", async () => {
    jest.spyOn(Payment, "findOne").mockResolvedValue(null);
    await request(app)
      .get("/api/business/checkout-result?session_id=missing-session")
      .expect(404);
  });

  test("serves database-backed plans and validates paid checkout requests", async () => {
    mongoose.connection.readyState = 1;
    const plans = [{ slug: "pro", name: "Pro", price: 9, active: true }];
    const sort = jest.fn().mockResolvedValue(plans);
    jest.spyOn(Plan, "bulkWrite").mockResolvedValue({});
    jest.spyOn(Plan, "find").mockReturnValue({ sort });
    jest.spyOn(BusinessSettings, "findOneAndUpdate").mockResolvedValue({
      brandName: "Example Brand",
      defaultCurrency: "USD"
    });

    const plansResponse = await request(app).get("/api/business/plans").expect(200);
    expect(plansResponse.body.plans).toEqual(plans);
    expect(sort).toHaveBeenCalledWith({ price: 1, name: 1 });

    const findPlan = jest.spyOn(Plan, "findOne").mockResolvedValue(null);
    await request(app)
      .post("/api/business/checkout-interest")
      .send({ planSlug: "missing", gateway: "stripe", email: "customer@example.com" })
      .expect(404);

    findPlan.mockResolvedValue({ slug: "free", price: 0 });
    await request(app)
      .post("/api/business/checkout-interest")
      .send({ planSlug: "free", gateway: "stripe", email: "customer@example.com" })
      .expect(400);

    findPlan.mockResolvedValue({ slug: "pro", price: 9, currency: "USD", interval: "yearly" });
    await request(app)
      .post("/api/business/checkout-interest")
      .send({ planSlug: "pro", gateway: "paypal", email: "customer@example.com" })
      .expect(400);

    await request(app)
      .post("/api/business/checkout-interest")
      .send({ planSlug: "pro", gateway: "stripe", email: "customer@example.com" })
      .expect(503);

    process.env.STRIPE_SECRET_KEY = "test-secret";
    process.env.APP_BASE_URL = "https://example.test";
    await request(app)
      .post("/api/business/checkout-interest")
      .send({ planSlug: "pro", gateway: "stripe", email: "invalid" })
      .expect(400);

    const payment = { _id: "payment-test", save: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(Payment, "create").mockResolvedValue(payment);
    const stripeFetch = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "session-test", url: "https://checkout.example.test" })
    });

    const checkout = await request(app)
      .post("/api/business/checkout-interest")
      .send({ planSlug: "pro", gateway: "stripe", email: "customer@example.com" })
      .expect(201);
    expect(checkout.body.checkoutUrl).toBe("https://checkout.example.test");
    expect(payment.reference).toBe("session-test");
    const yearlyCheckout = new URLSearchParams(stripeFetch.mock.calls[0][1].body);
    expect(yearlyCheckout.get("mode")).toBe("subscription");
    expect(yearlyCheckout.get("line_items[0][price_data][recurring][interval]")).toBe("year");

    findPlan.mockResolvedValue({ slug: "single", price: 15, currency: "USD", interval: "one-time" });
    await request(app)
      .post("/api/business/checkout-interest")
      .send({ planSlug: "single", gateway: "stripe", email: "customer@example.com" })
      .expect(201);
    const oneTimeCheckout = new URLSearchParams(stripeFetch.mock.calls[1][1].body);
    expect(oneTimeCheckout.get("mode")).toBe("payment");
    expect(oneTimeCheckout.has("line_items[0][price_data][recurring][interval]")).toBe(false);
  });

  test("validates connected API subscriptions, referrals, and ad leads", async () => {
    mongoose.connection.readyState = 1;
    await request(app)
      .post("/api/business/api-subscriptions")
      .send({ email: "invalid" })
      .expect(400);

    jest.spyOn(Plan, "findOne").mockResolvedValue({ slug: "pro", price: 9, apiLimit: 1000 });
    await request(app)
      .post("/api/business/api-subscriptions")
      .send({ email: "customer@example.com", planSlug: "pro" })
      .expect(409);

    Plan.findOne.mockResolvedValue({ slug: "free", price: 0, apiLimit: 100 });
    jest.spyOn(ApiSubscription, "create").mockResolvedValue({ apiKey: "sth_test" });
    await request(app)
      .post("/api/business/api-subscriptions")
      .send({ email: "customer@example.com", planSlug: "free" })
      .expect(201);

    jest.spyOn(Referral, "create").mockResolvedValue({ referrerEmail: "a@example.com" });
    await request(app).post("/api/business/referrals").send({}).expect(400);
    await request(app)
      .post("/api/business/referrals")
      .send({ referrerEmail: "a@example.com", invitedEmail: "b@example.com" })
      .expect(201);

    jest.spyOn(DirectAdLead, "create").mockResolvedValue({ email: "sales@example.com" });
    await request(app).post("/api/business/advertise").send({ email: "invalid" }).expect(400);
    await request(app)
      .post("/api/business/advertise")
      .send({ email: "sales@example.com", budget: "500" })
      .expect(201);
  });

  test("enforces API subscription limits and reports checkout status", async () => {
    mongoose.connection.readyState = 1;
    jest.spyOn(ApiSubscription, "findOne").mockResolvedValue(null);
    await request(app)
      .post("/api/business/v1/bmi")
      .set("X-API-Key", "invalid")
      .send({ weightKg: 80, heightCm: 180 })
      .expect(401);

    ApiSubscription.findOne.mockResolvedValue({ usedToday: 10, dailyLimit: 10 });
    await request(app)
      .post("/api/business/v1/bmi")
      .set("X-API-Key", "limited")
      .send({ weightKg: 80, heightCm: 180 })
      .expect(429);

    ApiSubscription.findOne.mockResolvedValue({ _id: "api-subscription", usedToday: 0, dailyLimit: 10 });
    await request(app)
      .post("/api/business/v1/bmi")
      .set("X-API-Key", "valid")
      .send({ weightKg: 80 })
      .expect(400);

    jest.spyOn(ApiSubscription, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    await request(app)
      .post("/api/business/v1/bmi")
      .set("X-API-Key", "valid")
      .send({ weightKg: 80, heightCm: 180 })
      .expect(200);

    jest.spyOn(Payment, "findOne").mockResolvedValue({
      status: "paid",
      planSlug: "pro",
      providerSessionId: "session-test"
    });
    jest.spyOn(ApiSubscription, "findOne").mockResolvedValue({ apiKey: "sth_paid" });
    const result = await request(app)
      .get("/api/business/checkout-result?session_id=session-test")
      .expect(200);
    expect(result.body.apiKey).toBe("sth_paid");
  });
});