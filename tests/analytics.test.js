const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const SearchLog = require("../models/SearchLog");
const Tool = require("../models/Tool");
const Subscriber = require("../models/Subscriber");
const Ad = require("../models/Ad");
const analyticsRouter = require("../routes/analytics");

const app = express();
app.use(express.json());
app.use("/api/analytics", analyticsRouter);

function sortedQuery(result) {
  const query = {
    sort: jest.fn(() => query),
    limit: jest.fn().mockResolvedValue(result)
  };
  return query;
}

describe("Analytics routes", () => {
  let readyState;

  beforeEach(() => {
    readyState = mongoose.connection.readyState;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mongoose.connection.readyState = readyState;
  });

  test("returns safe fallback responses while the database is disconnected", async () => {
    mongoose.connection.readyState = 0;
    await request(app).post("/api/analytics/event").send({}).expect(200)
      .expect(({ body }) => expect(body.reason).toBe("database-unavailable"));
    await request(app).post("/api/analytics/search").send({ query: "test" }).expect(200);
    await request(app).post("/api/analytics/newsletter").send({ email: "invalid" }).expect(200);
    await request(app).get("/api/analytics/ads").expect(200, []);
    await request(app).post("/api/analytics/ads/ad-1/click").expect(200);
    await request(app).get("/api/analytics/related-tools/pdf-to-word").expect(200, { related: [], popular: [] });
  });

  test("classifies and stores analytics events, and skips empty searches", async () => {
    mongoose.connection.readyState = 1;
    const createEvent = jest.spyOn(AnalyticsEvent, "create").mockResolvedValue({});
    const eventCases = [
      { referrer: "https://google.com/search", userAgent: "iPhone", source: "google", device: "mobile" },
      { referrer: "https://bing.com/search", userAgent: "Desktop", source: "bing", device: "desktop" },
      { referrer: "https://linkedin.com/feed", userAgent: "Android", source: "social", device: "mobile" },
      { referrer: "https://partner.example/page", userAgent: "Desktop", source: "referral", device: "desktop" },
      { referrer: "", userAgent: "Desktop", source: "direct", device: "desktop" }
    ];

    for (const eventCase of eventCases) {
      await request(app)
        .post("/api/analytics/event")
        .set("User-Agent", eventCase.userAgent)
        .set("CF-IPCountry", "RW")
        .send({
          type: "page_view",
          path: "p".repeat(350),
          toolSlug: "s".repeat(140),
          referrer: eventCase.referrer
        })
        .expect(200);
    }

    const stored = createEvent.mock.calls[0][0];
    expect(stored.path).toHaveLength(300);
    expect(stored.toolSlug).toHaveLength(120);
    expect(stored.country).toBe("RW");
    expect(createEvent.mock.calls.map(([event]) => event.source)).toEqual(eventCases.map((item) => item.source));
    expect(createEvent.mock.calls.map(([event]) => event.device)).toEqual(eventCases.map((item) => item.device));

    await request(app).post("/api/analytics/search").send({ query: "   " }).expect(200)
      .expect(({ body }) => expect(body.skipped).toBe(true));
    const createSearch = jest.spyOn(SearchLog, "create").mockResolvedValue({});
    await request(app)
      .post("/api/analytics/search")
      .send({ query: ` ${"q".repeat(170)} `, resultCount: "5" })
      .expect(200);
    expect(createSearch).toHaveBeenCalledWith({ query: "q".repeat(160), resultCount: 5 });
  });

  test("validates newsletter signups and serves filtered ads", async () => {
    mongoose.connection.readyState = 1;
    const updateSubscriber = jest.spyOn(Subscriber, "updateOne").mockResolvedValue({ upsertedCount: 1 });
    await request(app).post("/api/analytics/newsletter").send({ email: "bad" }).expect(400);
    await request(app).post("/api/analytics/newsletter").send({ email: " User@Example.com " }).expect(200);
    expect(updateSubscriber).toHaveBeenCalledWith(
      { email: "user@example.com" },
      { $setOnInsert: { email: "user@example.com" } },
      { upsert: true }
    );

    const ads = [{ _id: "ad-1" }];
    const filteredQuery = sortedQuery(ads);
    const allQuery = sortedQuery([]);
    const findAds = jest.spyOn(Ad, "find").mockReturnValueOnce(filteredQuery).mockReturnValueOnce(allQuery);
    await request(app).get("/api/analytics/ads?position=sidebar").expect(200, ads);
    await request(app).get("/api/analytics/ads").expect(200, []);
    expect(findAds).toHaveBeenNthCalledWith(1, { active: true, position: "sidebar" });
    expect(findAds).toHaveBeenNthCalledWith(2, { active: true });

    const click = jest.spyOn(Ad, "findByIdAndUpdate").mockResolvedValue({});
    await request(app).post("/api/analytics/ads/ad-1/click").expect(200);
    expect(click).toHaveBeenCalledWith("ad-1", { $inc: { clicks: 1 } });
  });

  test("loads related and popular tools with and without a category match", async () => {
    mongoose.connection.readyState = 1;
    const current = { _id: "current", category: "pdf" };
    const findOne = jest.spyOn(Tool, "findOne").mockResolvedValueOnce(current).mockResolvedValueOnce(null);
    const relatedQuery = sortedQuery([{ slug: "related" }]);
    const popularQuery = sortedQuery([{ slug: "popular" }]);
    const missingCurrentPopularQuery = sortedQuery([{ slug: "popular" }]);
    const findTools = jest.spyOn(Tool, "find")
      .mockReturnValueOnce(relatedQuery)
      .mockReturnValueOnce(popularQuery)
      .mockReturnValueOnce(missingCurrentPopularQuery);

    const matching = await request(app).get("/api/analytics/related-tools/current").expect(200);
    expect(matching.body.related).toEqual([{ slug: "related" }]);
    expect(findTools).toHaveBeenNthCalledWith(1, {
      _id: { $ne: current._id },
      category: "pdf",
      status: "active"
    });

    const missing = await request(app).get("/api/analytics/related-tools/missing").expect(200);
    expect(missing.body.related).toEqual([]);
    expect(missing.body.popular).toEqual([{ slug: "popular" }]);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  test("returns stable server errors when analytics persistence fails", async () => {
    mongoose.connection.readyState = 1;

    jest.spyOn(AnalyticsEvent, "create").mockRejectedValue(new Error("event write failed"));
    await request(app)
      .post("/api/analytics/event")
      .send({ type: "page_view" })
      .expect(500);

    jest.spyOn(SearchLog, "create").mockRejectedValue(new Error("search write failed"));
    await request(app)
      .post("/api/analytics/search")
      .send({ query: "conversion tools" })
      .expect(500);

    jest.spyOn(Subscriber, "updateOne").mockRejectedValue(new Error("subscriber write failed"));
    await request(app)
      .post("/api/analytics/newsletter")
      .send({ email: "user@example.com" })
      .expect(500);

    jest.spyOn(Ad, "find").mockImplementation(() => { throw new Error("ad query failed"); });
    await request(app).get("/api/analytics/ads").expect(500);

    jest.spyOn(Ad, "findByIdAndUpdate").mockRejectedValue(new Error("click write failed"));
    await request(app).post("/api/analytics/ads/ad-1/click").expect(500);

    jest.spyOn(Tool, "findOne").mockRejectedValue(new Error("tool query failed"));
    await request(app).get("/api/analytics/related-tools/tool-1").expect(500);
  });
});