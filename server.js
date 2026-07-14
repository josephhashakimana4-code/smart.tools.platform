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
   ENHANCED SECURITY LAYER
========================= */
// Enhanced helmet configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
  })
);

app.use(compression());
app.use(morgan("combined"));

// CORS whitelist - update with your actual domains
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:5000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Admin-Token"],
    maxAge: 86400
  })
);

app.use(express.json({ limit: "2mb" }));

/* =========================
   SECURITY MIDDLEWARE
========================= */
const { sanitizeMiddleware, limitBodySize } = require("./middlewares/validation");
const { csrfProtection, generateCsrfTokenMiddleware } = require("./middlewares/csrf");
const { auditMiddleware } = require("./middlewares/audit");

app.use(sanitizeMiddleware);
app.use(limitBodySize("5mb"));
app.use(generateCsrfTokenMiddleware);
app.use(auditMiddleware);

/* =========================
   MODELS
========================= */
const Tool = require("./models/Tool");
const BlogPost = require("./models/BlogPost");
const ErrorLog = require("./models/ErrorLog");
const Affiliate = require("./models/Affiliate");
const User = require("./models/User");

/* =========================
   ROUTES
========================= */
const authRoute = require("./routes/auth");
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
const { authMiddleware } = require("./middlewares/jwt-auth");

/* =========================
   RATE LIMITING (Granular)
========================= */
// General rate limit: 120 requests per minute
app.use(
  createLimiter({
    windowMs: 60 * 1000,
    max: 120
  })
);

// Stricter limit for auth endpoints: 5 requests per 15 minutes
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false
});

// Moderate limit for API endpoints: 30 requests per minute
const apiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30
});

/* =========================
   DB CONNECTION
========================= */
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smarttools";

mongoose
  .connect(mongoUri)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.warn("MongoDB unavailable, continuing without database:", err.message);
  });

/* =========================
   IMPORTANT FIX HERE
   ADMIN ROUTE MUST NOT BE PROTECTED GLOBALLY
========================= */
app.use("/api/admin", adminRoute);

/* =========================
   AUTHENTICATION ROUTES
========================= */
app.use("/api/auth", authLimiter, authRoute);

/* =========================
   PUBLIC API ROUTES
========================= */
app.use("/api/tools", toolsRoute);
app.use("/api/contact", contactRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/blog", blogRoute);
app.use("/api/business", businessRoute);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    service: "smart-tools-platform",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    service: "smart-tools-platform",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

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

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get(["/admin", "/admin.html"], (req, res) => {
  res.sendFile(path.join(frontendPath, "admin.html"));
});

app.use(express.static(frontendPath));

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
  "ai-tools.html",
  "contact.html",
  "privacy.html",
  "terms.html",
  "cookies.html",
  "disclaimer.html",
  "affiliate-disclosure.html",
  "calculator.html",
  "pdf-to-word.html"
];

pages.forEach((page) => {
  const route = `/${page.replace(".html", "")}`;

  app.get(route, (req, res) => {
    res.sendFile(path.join(frontendPath, page));
  });
});

app.get(["/tools", "/tools/"], (req, res) => {
  res.sendFile(path.join(frontendPath, "tool.html"));
});

app.get(["/tools/:slug", "/tools/:slug/"], (req, res) => {
  res.sendFile(path.join(frontendPath, "tool.html"));
});

app.get(["/blog/:slug", "/blog/:slug/"], (req, res) => {
  res.sendFile(path.join(frontendPath, "blog-post.html"));
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
    "/ai-tools",
    "/advertise",
    "/api-marketplace",
    "/white-label",
    "/contact",
    "/privacy",
    "/terms",
    "/cookies",
    "/disclaimer",
    "/affiliate-disclosure",
    "/calculator",
    "/pdf-to-word",
    "/tools/calculator",
    "/tools/pdf-to-word"
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
