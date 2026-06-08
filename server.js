const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const Tool = require("./models/Tool");
const BlogPost = require("./models/BlogPost");
const ErrorLog = require("./models/ErrorLog");
require("dotenv").config();

const app = express();

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

// static downloads
app.use("/download", express.static(path.join(__dirname, "converted")));

// DB
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/toolsdb")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// routes
const toolsRoute = require("./routes/tools");
const contactRoute = require("./routes/contact");
const adminRoute = require("./routes/admin");
const analyticsRoute = require("./routes/analytics");
const blogRoute = require("./routes/blog");
const businessRoute = require("./routes/business");

app.use("/api/tools", toolsRoute);
app.use("/api/contact", contactRoute);
app.use("/api/admin", adminRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/blog", blogRoute);
app.use("/api/business", businessRoute);

const frontendPath = path.join(__dirname, "..", "frontend");

function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function sendFrontendPage(fileName) {
  return (req, res, next) => {
    const filePath = path.join(frontendPath, fileName);
    fs.readFile(filePath, "utf8", (err, html) => {
      if (err) return next(err);
      res.type("html").send(html.replace(/__SITE_URL__/g, getBaseUrl(req)));
    });
  };
}

app.get(["/", "/index.html"], sendFrontendPage("index.html"));

app.get(["/tool", "/tools", "/tool.html"], sendFrontendPage("tool.html"));

app.get(["/admin", "/dashboard", "/admin.html"], sendFrontendPage("admin.html"));

app.get(["/blog", "/blog/"], sendFrontendPage("blog.html"));

app.get("/blog/:slug", sendFrontendPage("blog-post.html"));

app.get(["/pricing", "/pricing.html"], sendFrontendPage("pricing.html"));

app.get(["/advertise", "/advertise.html"], sendFrontendPage("advertise.html"));

app.get(["/api-marketplace", "/api-marketplace.html"], sendFrontendPage("api-marketplace.html"));

app.get(["/white-label", "/white-label.html"], sendFrontendPage("white-label.html"));

app.get(["/ai-tools", "/ai-tools.html"], sendFrontendPage("ai-tools.html"));

app.get("/robots.txt", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.type("text/plain").send([
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /admin.html",
    "Disallow: /api/admin",
    "Allow: /",
    `Sitemap: ${baseUrl}/sitemap.xml`
  ].join("\n"));
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const [tools, posts] = await Promise.all([
      Tool.find({ status: "active" }).select("slug lastViewedAt"),
      BlogPost.find({ status: "published" }).select("slug updatedAt publishedAt")
    ]);

    const urls = [
      { loc: `${baseUrl}/`, priority: "1.0" },
      { loc: `${baseUrl}/blog`, priority: "0.8" },
      { loc: `${baseUrl}/pricing`, priority: "0.8" },
      { loc: `${baseUrl}/api-marketplace`, priority: "0.8" },
      { loc: `${baseUrl}/advertise`, priority: "0.8" },
      { loc: `${baseUrl}/white-label`, priority: "0.7" },
      { loc: `${baseUrl}/ai-tools`, priority: "0.7" },
      ...tools.map((tool) => ({
        loc: `${baseUrl}/tool.html?slug=${encodeURIComponent(tool.slug)}`,
        lastmod: tool.lastViewedAt,
        priority: "0.9"
      })),
      ...posts.map((post) => ({
        loc: `${baseUrl}/blog/${encodeURIComponent(post.slug)}`,
        lastmod: post.updatedAt || post.publishedAt,
        priority: "0.7"
      }))
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url>\n    <loc>${url.loc}</loc>${url.lastmod ? `\n    <lastmod>${new Date(url.lastmod).toISOString()}</lastmod>` : ""}\n    <priority>${url.priority}</priority>\n  </url>`).join("\n")}\n</urlset>`;
    res.type("application/xml").send(xml);
  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).type("text/plain").send("Failed to generate sitemap.");
  }
});

const legacyToolPages = {
  "/calculator.html": "calculator",
  "/percentagecalculator.html": "percentage-calculator",
  "/percentage-calculator.html": "percentage-calculator",
  "/bmi-calculator.html": "bmi-calculator",
  "/age-calculator.html": "age-calculator",
  "/unit-converter.html": "unit-converter",
  "/pdf-to-word.html": "pdf-to-word",
  "/word-to-pdf.html": "word-to-pdf",
  "/merge-pdf.html": "merge-pdf",
  "/split-pdf.html": "split-pdf",
  "/pdf-compressor.html": "pdf-compressor"
};

app.get(Object.keys(legacyToolPages), (req, res) => {
  res.redirect(`/tool.html?slug=${legacyToolPages[req.path]}`);
});

app.use(express.static(frontendPath));

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  ErrorLog.create({
    type: "server",
    message: err.message,
    stack: err.stack,
    path: req.originalUrl
  }).catch(() => {});
  res.status(500).json({ message: "Something went wrong." });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the old Node server before starting this one again.`);
    console.error("PowerShell: Get-Process node | Stop-Process");
    process.exit(1);
  }

  throw err;
});
