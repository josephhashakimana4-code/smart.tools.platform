const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const Tool = require("../models/Tool");
const ConvertedFile = require("../models/ConvertedFile");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Ad = require("../models/Ad");
const BlogPost = require("../models/BlogPost");
const Subscriber = require("../models/Subscriber");
const Contact = require("../models/contact");
const Plan = require("../models/Plan");
const Payment = require("../models/Payment");
const ApiSubscription = require("../models/ApiSubscription");
const Affiliate = require("../models/Affiliate");
const BusinessSettings = require("../models/BusinessSettings");
const DirectAdLead = require("../models/DirectAdLead");
const adminRouter = require("../routes/admin");

const app = express();
app.use(express.json());
app.use("/api/admin", adminRouter);

describe("Admin routes without a database", () => {
  let token;
  let readyState;

  const adminRequest = (method, path, body) => {
    let req = request(app)[method](`/api/admin${path}`).set("X-Admin-Token", token);
    if (body !== undefined) req = req.send(body);
    return req;
  };

  beforeEach(async () => {
    readyState = mongoose.connection.readyState;
    const response = await request(app)
      .post("/api/admin/login")
      .send({ password: process.env.ADMIN_PASSWORD })
      .expect(200);
    token = response.body.token;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mongoose.connection.readyState = readyState;
  });

  test("rejects invalid credentials and protects admin routes", async () => {
    await request(app)
      .post("/api/admin/login")
      .send({ password: "incorrect" })
      .expect(401);

    await request(app).get("/api/admin/stats").expect(401);
    await request(app)
      .get("/api/admin/stats")
      .set("X-Admin-Token", "invalid-token")
      .expect(401);

    const stats = await adminRequest("get", "/stats").expect(200);
    expect(stats.body.totalTools).toBeGreaterThan(0);
    expect(stats.body).toHaveProperty("unreadContacts");
    expect(stats.body.storageMode).toBe("memory");
    await adminRequest("post", "/payments/payment-id/cancel", {}).expect(503);
    await adminRequest("post", "/payments/payment-id/refund", {}).expect(503);
  });

  test("serves fallback settings, revenue, and export data", async () => {
    const initialSettings = await adminRequest("get", "/business-settings").expect(200);
    expect(initialSettings.body.key).toBe("default");

    const updatedSettings = await adminRequest("put", "/business-settings", {
      brandName: "Coverage Test"
    }).expect(200);
    expect(updatedSettings.body.brandName).toBe("Coverage Test");

    const revenue = await adminRequest("get", "/revenue-summary").expect(200);
    expect(revenue.body.totalRevenue).toBe(0);

    const exportResponse = await adminRequest("get", "/payments/export").expect(200);
    expect(exportResponse.text).toContain('"createdAt","customerEmail","planSlug"');

    await adminRequest("get", "/subscribers").expect(200);
    await adminRequest("get", "/contacts").expect(200);
    await adminRequest("get", "/direct-ad-leads").expect(200, []);
  });

  test("supports fallback CRUD for dashboard-managed resources", async () => {
    const resources = [
      { path: "/tools", payload: { name: "Coverage Tool", slug: "coverage-tool" }, update: { name: "Updated Tool" } },
      { path: "/ads", payload: { title: "Coverage Ad" }, update: { title: "Updated Ad" } },
      { path: "/affiliates", payload: { name: "Coverage Affiliate" }, update: { name: "Updated Affiliate" } },
      { path: "/blog-posts", payload: { title: "Coverage Post" }, update: { title: "Updated Post" } },
      { path: "/plans", payload: { name: "Coverage Plan" }, update: { name: "Updated Plan" } },
      { path: "/payments", payload: { reference: "coverage-payment" }, update: { reference: "updated-payment" }, deletable: false },
      { path: "/api-subscriptions", payload: { email: "coverage@example.com" }, update: { status: "active" } }
    ];

    for (const resource of resources) {
      const created = await adminRequest("post", resource.path, resource.payload).expect(201);
      expect(created.body._id).toBeDefined();

      const listed = await adminRequest("get", resource.path).expect(200);
      expect(listed.body.some((item) => item._id === created.body._id)).toBe(true);

      await adminRequest("put", `${resource.path}/${created.body._id}`, resource.update).expect(200);
      await adminRequest("put", `${resource.path}/missing-record`, resource.update).expect(404);
      if (resource.deletable !== false) {
        await adminRequest("delete", `${resource.path}/${created.body._id}`).expect(200);
      }
    }
  });

  test("aggregates connected dashboard statistics", async () => {
    mongoose.connection.readyState = 1;
    jest.spyOn(Tool, "countDocuments")
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    jest.spyOn(Tool, "aggregate")
      .mockResolvedValueOnce([{ _id: "pdf", count: 2 }])
      .mockResolvedValueOnce([{ views: 50, clicks: 7 }]);
    jest.spyOn(ConvertedFile, "aggregate").mockResolvedValue([{ files: 5, downloads: 10, size: 1024 }]);
    jest.spyOn(AnalyticsEvent, "countDocuments").mockResolvedValueOnce(11).mockResolvedValueOnce(30);
    jest.spyOn(Subscriber, "countDocuments").mockResolvedValue(8);
    jest.spyOn(Contact, "countDocuments").mockResolvedValue(2);
    jest.spyOn(Ad, "aggregate").mockResolvedValue([{ clicks: 9 }]);

    const response = await adminRequest("get", "/stats").expect(200);
    expect(response.body).toMatchObject({
      storageMode: "database",
      totalTools: 4,
      activeTools: 3,
      inactiveTools: 1,
      views: 50,
      affiliateClicks: 7,
      visitorsToday: 11,
      visitorsMonth: 30,
      subscribers: 8,
      unreadContacts: 2,
      adClicks: 9
    });
  });

  test("uses connected model CRUD and not-found branches", async () => {
    mongoose.connection.readyState = 1;
    const resources = [
      { path: "/tools", model: Tool, deletable: true, payload: { name: "Tool" } },
      { path: "/ads", model: Ad, deletable: true, payload: { title: "Ad" } },
      { path: "/affiliates", model: Affiliate, deletable: true, payload: { name: "Affiliate" } },
      { path: "/blog-posts", model: BlogPost, deletable: true, payload: { title: "Post" } },
      { path: "/plans", model: Plan, deletable: true, payload: { name: "Plan" } },
      { path: "/payments", model: Payment, deletable: false, payload: { reference: "payment" } },
      { path: "/api-subscriptions", model: ApiSubscription, deletable: true, payload: { ownerEmail: "api@example.com" } }
    ];

    for (const resource of resources) {
      const record = { _id: `${resource.path.slice(1).replace(/-/g, "")}-record`, ...resource.payload };
      const sort = jest.fn().mockResolvedValue([record]);
      jest.spyOn(resource.model, "find").mockReturnValue({ sort });
      jest.spyOn(resource.model, "create").mockResolvedValue(record);
      jest.spyOn(resource.model, "findByIdAndUpdate")
        .mockResolvedValueOnce(record)
        .mockResolvedValueOnce(null);
      if (resource.deletable) {
        jest.spyOn(resource.model, "findByIdAndDelete").mockResolvedValue(record);
      }

      await adminRequest("get", resource.path).expect(200);
      await adminRequest("post", resource.path, resource.payload).expect(201);
      await adminRequest("put", `${resource.path}/${record._id}`, { name: "Updated" }).expect(200);
      await adminRequest("put", `${resource.path}/missing-record`, { name: "Updated" }).expect(404);
      if (resource.deletable) {
        await adminRequest("delete", `${resource.path}/${record._id}`).expect(200);
      }
    }

    jest.spyOn(Subscriber, "find").mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    jest.spyOn(Subscriber, "findByIdAndDelete").mockResolvedValue({});
    await adminRequest("get", "/subscribers").expect(200);
    await adminRequest("delete", "/subscribers/subscriber-id").expect(200);

    jest.spyOn(Contact, "find").mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    jest.spyOn(Contact, "findByIdAndUpdate").mockResolvedValueOnce({ _id: "contact-id" }).mockResolvedValueOnce(null);
    jest.spyOn(Contact, "findByIdAndDelete").mockResolvedValue({});
    await adminRequest("get", "/contacts").expect(200);
    await adminRequest("put", "/contacts/contact-id", { status: "read" }).expect(200);
    await adminRequest("put", "/contacts/missing-record", { status: "read" }).expect(404);
    await adminRequest("delete", "/contacts/contact-id").expect(200);

    const leads = [{ _id: "lead-id", email: "sales@example.com" }];
    jest.spyOn(DirectAdLead, "find").mockReturnValue({ sort: jest.fn().mockResolvedValue(leads) });
    const leadResponse = await adminRequest("get", "/direct-ad-leads").expect(200);
    expect(leadResponse.body).toEqual(leads);

    jest.spyOn(BusinessSettings, "findOneAndUpdate").mockResolvedValue({ key: "default", brandName: "Connected" });
    await adminRequest("get", "/business-settings").expect(200);
    await adminRequest("put", "/business-settings", { brandName: "Updated" }).expect(200);
  });
});