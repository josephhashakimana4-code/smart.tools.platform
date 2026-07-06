const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
require("dotenv").config();

/* =========================
   CORE APP
========================= */
const app = express();
app.set("trust proxy", 1);

/* =========================
   SECURITY LAYER
========================= */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(compression());
app.use(morgan("combined"));

app.use(
  cors({
    origin: "*",
    credentials: true
  })
);

app.use(express.json({ limit: "2mb" }));

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
   MIDDLEWARES
========================= */
const createLimiter = require("./middlewares/rateLimiter");
const errorHandler = require("./middlewares/errorHandler");

/* =========================
   RATE LIMIT
========================= */
app.use(
  createLimiter({
    windowMs: 60 * 1000,
    max: 120
  })
);

/* =========================
   DB CONNECTION
========================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB Error:", err);
    process.exit(1);
  });

/* =========================
   IMPORTANT FIX HERE
   ADMIN ROUTE MUST NOT BE PROTECTED GLOBALLY
========================= */
app.use("/api/admin", adminRoute);

/* =========================
   PUBLIC API ROUTES
========================= */
app.use("/api/tools", toolsRoute);
app.use("/api/contact", contactRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/blog", blogRoute);
app.use("/api/business", businessRoute);

/* =========================
   AFFILIATE SYSTEM
========================= */
app.get("/go/:tool", async (req, res) => {
  try {
    const record = await Affiliate.findOne({
      key: req.params.tool.toLowerCase(),
      active: true
    });

    if (!record) return res.redirect("/");

    record.clicks = (record.clicks || 0) + 1;
    await record.save();

    return res.redirect(record.affiliate_url || record.base_url);
  } catch (err) {
    console.error(err);
    return res.redirect("/");
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
   PAGE ROUTING
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
});

/* =========================
   DOWNLOADS
========================= */
app.use("/download", express.static(path.join(__dirname, "converted")));

/* =========================
   ROBOTS.TXT
========================= */
app.get("/robots.txt", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.type("text/plain").send(`
User-agent: *
Disallow: /admin
Disallow: /api/admin
Allow: /
Sitemap: ${baseUrl}/sitemap.xml
  `.trim());
});

/* =========================
   SIMPLE SITEMAP
========================= */
app.get("/sitemap.xml", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const urls = [
    "/",
    "/blog",
    "/pricing",
    "/ai-tools"
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `
  <url>
    <loc>${baseUrl + u}</loc>
    <priority>0.8</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  res.type("application/xml").send(xml);
});

/* =========================
   LEGACY REDIRECTS
========================= */
const legacyToolPages = {
  "/calculator.html": "calculator",
  "/bmi-calculator.html": "bmi-calculator",
  "/unit-converter.html": "unit-converter"
};

app.get(Object.keys(legacyToolPages), (req, res) => {
  res.redirect(`/tool.html?slug=${legacyToolPages[req.path]}`);
});

/* =========================
   ERROR HANDLER (LAST)
========================= */
app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  ErrorLog.create({
    type: "server",
    message: err.message,
    stack: err.stack,
    path: req.originalUrl
  }).catch(() => {});

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
});

/* =========================
   GRACEFUL SHUTDOWN
========================= */
process.on("SIGTERM", async () => {
  console.log("SIGTERM received");
  await mongoose.connection.close();
  process.exit(0);
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
