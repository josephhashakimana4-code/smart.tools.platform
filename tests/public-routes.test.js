const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const Ad = require("../models/Ad");
const BlogPost = require("../models/BlogPost");
const adsRouter = require("../routes/ads");
const blogRouter = require("../routes/blog");

const app = express();
app.use("/api/ads", adsRouter);
app.use("/api/blog", blogRouter);

function adQuery(result) {
  const query = {
    sort: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(result)
  };
  return query;
}

describe("Public read-only routes", () => {
  let readyState;

  beforeEach(() => {
    readyState = mongoose.connection.readyState;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mongoose.connection.readyState = readyState;
  });

  test("returns no ads while disconnected and blocks public mutations", async () => {
    mongoose.connection.readyState = 0;
    await request(app).get("/api/ads").expect(200, []);
    await request(app).post("/api/ads").send({}).expect(405);
    await request(app).put("/api/ads/ad-1").send({}).expect(405);
    await request(app).delete("/api/ads/ad-1").expect(405);
  });

  test("normalizes ad positions and reports query errors", async () => {
    mongoose.connection.readyState = 1;
    const records = [{ _id: 42, title: "Ad" }];
    const find = jest.spyOn(Ad, "find")
      .mockReturnValueOnce(adQuery(records))
      .mockReturnValueOnce(adQuery([]))
      .mockReturnValueOnce(adQuery([]));

    const sidebar = await request(app).get("/api/ads?position=SIDEBAR").expect(200);
    expect(sidebar.body[0]._id).toBe("42");
    expect(find).toHaveBeenNthCalledWith(1, { active: true, position: "sidebar" });

    await request(app).get("/api/ads?position=invalid").expect(200);
    expect(find).toHaveBeenNthCalledWith(2, { active: true, position: "top" });

    await request(app).get("/api/ads").expect(200);
    expect(find).toHaveBeenNthCalledWith(3, { active: true });

    find.mockImplementation(() => { throw new Error("database failure"); });
    await request(app).get("/api/ads").expect(500);
  });

  test("serves published blog posts and distinguishes missing records from errors", async () => {
    const posts = [{ slug: "published-post" }];
    const sort = jest.fn().mockReturnThis();
    const select = jest.fn().mockResolvedValue(posts);
    jest.spyOn(BlogPost, "find").mockReturnValue({ sort, select });
    const list = await request(app).get("/api/blog").expect(200);
    expect(list.body).toEqual(posts);
    expect(BlogPost.find).toHaveBeenCalledWith({ status: "published" });

    jest.spyOn(BlogPost, "findOne").mockResolvedValue(null);
    await request(app).get("/api/blog/missing-post").expect(404);

    BlogPost.findOne.mockResolvedValue(posts[0]);
    await request(app).get("/api/blog/published-post").expect(200, posts[0]);

    BlogPost.findOne.mockRejectedValue(new Error("database failure"));
    await request(app).get("/api/blog/broken-post").expect(500);
  });
});