const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
require("dotenv").config();

/* =========================
   MODELS
========================= */
const Tool = require("./models/Tool");
const BlogPost = require("./models/BlogPost");
const ErrorLog = require("./models/ErrorLog");
const Affiliate = require("./models/Affiliate");

/* =========================
   ROUTES
========================= */
const toolsRoute = require("./routes/tools");
const contactRoute = require("./routes/contact");
const adminRoute = require("./routes/admin");
const analyticsRoute = require("./routes/analytics");
const blogRoute = require("./routes/blog");
const businessRoute = require("./routes/business");

/* =========================
   MIDDLEWARE (SAAS LAYER)
========================= */
const auth = require("./middleware/auth");
const role = require("./middleware/role");
const createLimiter = require("./middleware/rateLimit");

/* =========================
   APP INIT
========================= */
const app = express();

app.set("trust proxy", 1);

/* =========================
   SECURITY MIDDLEWARE
========================= */
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

/* =========================
   GLOBAL RATE LIMIT
   (per IP or per user if logged in)
========================= */
app.use(
  createLimiter({
    windowMs: 60 * 1000,
    max: 120
  })
);

/* =========================
   DATABASE CONNECTION
========================= */
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/toolsdb")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Error:", err));

/* =========================
   API ROUTES
========================= */
app.use("/api/tools", toolsRoute);
app.use("/api/contact", contactRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/blog", blogRoute);
app.use("/api/business", businessRoute);

/* =========================
   ADMIN ROUTES (PROTECTED)
========================= */
app.use("/api/admin", auth, role("admin"), adminRoute);

/* =========================
   AFFILIATE REDIRECT SYSTEM
========================= */
app.get("/go/:tool", async (req, res) => {
  try {
    const tool = req.params.tool.toLowerCase();

    const record = await Affiliate.findOne({ key: tool, active: true });

    if (!record) return res.redirect("/");

    record.clicks = (record.clicks || 0) + 1;
    await record.save();

    return res.redirect(record.affiliate_url || record.base_url);
  } catch (err) {
    console.error("GO ROUTE ERROR:", err);

    await ErrorLog.create({
      type: "affiliate_redirect",
      message: err.message,
      stack: err.stack,
      path: req.originalUrl
    }).catch(() => {});

    return res.status(500).send("Redirect error");
  }
});

/* =========================
   STATIC FRONTEND
========================= */
const frontendPath = path.join(__dirname, "frontend");

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* =========================
   STATIC PAGES ROUTING
========================= */
const pages = [
  "tool.html",
  "admin.html",
  "blog.html",
  "blog-post.html",
  "pricing.html",
  "advertise.html",
  "api-marketplace.html",
  "white-label.html",
  "ai-tools.html"
];

pages.forEach((page) => {
  const route = `/${page.replace(".html", "")}`;

  app.get(route, (req, res) => {
    res.sendFile(path.join(frontendPath, page));
  });

  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(frontendPath, page));
  });
});

/* =========================
   DOWNLOAD FILES
========================= */
app.use("/download", express.static(path.join(__dirname, "converted")));

/* =========================
   ROBOTS.TXT
========================= */
app.get("/robots.txt", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.type("text/plain").send(
    [
      "User-agent: *",
      "Disallow: /admin",
      "Disallow: /dashboard",
      "Disallow: /admin.html",
      "Disallow: /api/admin",
      "Allow: /",
      `Sitemap: ${baseUrl}/sitemap.xml`
    ].join("\n")
  );
});

/* =========================
   SITEMAP GENERATION
========================= */
app.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const [tools, posts] = await Promise.all([
      Tool.find({ status: "active" }).select("slug lastViewedAt"),
      BlogPost.find({ status: "published" }).select(
        "slug updatedAt publishedAt"
      )
    ]);

    const urls = [
      { loc: `${baseUrl}/`, priority: "1.0" },
      { loc: `${baseUrl}/blog`, priority: "0.8" },
      { loc: `${baseUrl}/pricing`, priority: "0.8" },
      { loc: `${baseUrl}/api-marketplace`, priority: "0.8" },
      { loc: `${baseUrl}/advertise`, priority: "0.8" },
      { loc: `${baseUrl}/white-label`, priority: "0.7" },
      { loc: `${baseUrl}/ai-tools`, priority: "0.7" },

      ...tools.map((t) => ({
        loc: `${baseUrl}/tool.html?slug=${encodeURIComponent(t.slug)}`,
        lastmod: t.lastViewedAt,
        priority: "0.9"
      })),

      ...posts.map((p) => ({
        loc: `${baseUrl}/blog/${encodeURIComponent(p.slug)}`,
        lastmod: p.updatedAt || p.publishedAt,
        priority: "0.7"
      }))
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `
  <url>
    <loc>${u.loc}</loc>
    ${
      u.lastmod
        ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>`
        : ""
    }
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.type("application/xml").send(xml);
  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).send("Failed to generate sitemap.");
  }
});

/* =========================
   LEGACY REDIRECTS
========================= */
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

/* =========================
   ERROR HANDLING
========================= */
app.use(async (err, req, res, next) => {
  console.error("Unhandled server error:", err);

  await ErrorLog.create({
    type: "server",
    message: err.message,
    stack: err.stack,
    path: req.originalUrl
  }).catch(() => {});

  res.status(500).json({ message: "Something went wrong." });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
