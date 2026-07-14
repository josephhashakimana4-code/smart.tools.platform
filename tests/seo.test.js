const request = require("supertest");

jest.mock("mongoose", () => ({
  connect: jest.fn().mockResolvedValue(true),
  connection: { readyState: 1, close: jest.fn().mockResolvedValue(true) }
}));

const app = require("../server");

describe("SEO endpoints", () => {
  it("serves robots.txt with the sitemap reference", async () => {
    const res = await request(app).get("/robots.txt");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Sitemap:");
  });

  it("serves an XML sitemap with public URLs", async () => {
    const res = await request(app).get("/sitemap.xml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.text).toContain("<urlset");
    expect(res.text).toContain("/tools/");
  });

  it("serves the tool page through a clean URL route", async () => {
    const res = await request(app).get("/tools/calculator");

    expect(res.status).toBe(200);
    expect(res.text).toContain("<html");
  });
});
