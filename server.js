const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const cleanupFolder = require("./utils/fileCleanup");

require("dotenv").config();

/* =========================
   CORE APP
========================= */


const app = express();


// Automatic temporary file cleanup
const uploadsPath = path.join(__dirname, "uploads");
const convertedPath = path.join(__dirname, "converted");

setInterval(() => {
  cleanupFolder(uploadsPath, 60);
  cleanupFolder(convertedPath, 60);
}, 60 * 60 * 1000);


// Security Middleware
app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
app.use(morgan("combined"));
app.use(hpp());

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests"
});

app.use("/api", apiLimiter);


app.set("trust proxy", 1);


/* =========================
   SECURITY HEADERS
========================= */

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        styleSrc: [
          "'self'",
          "'unsafe-inline'"
        ],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        connectSrc: [
          "'self'",
          "https://*.app.github.dev",
          "https://*.onrender.com"
        ],

        fontSrc: [
          "'self'",
          "https:"
        ],

        objectSrc: [
          "'none'"
        ],

        mediaSrc: [
          "'self'"
        ],

            frameSrc: [
          "'self'"
        ]
      }
    },

    frameguard: {
      action: "deny"
    },

    crossOriginEmbedderPolicy: false,

    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups"
    },

    crossOriginResourcePolicy: {
      policy: "cross-origin"
    },

    hidePoweredBy: true,

    hsts: {
      maxAge: 31536000,
      includeSubDomains: true
    },

    noSniff: true,

    referrerPolicy: {
      policy: "strict-origin-when-cross-origin"
    }
  })
);


app.use(compression());

app.use(morgan("combined"));



/* =========================
   UPDATED CORS SYSTEM
========================= */


const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
];


const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];


const allowedOrigins = [
  ...defaultOrigins,
  ...envOrigins
];



app.use(
  cors({

    origin: function(origin, callback){

      // allow server-to-server requests
      if(!origin){
        return callback(null,true);
      }


      // exact matches
      if(
        allowedOrigins.includes(origin)
      ){
        return callback(null,true);
      }


      // GitHub Codespaces
      if(
        origin.includes(".app.github.dev")
      ){
        return callback(null,true);
      }


      // Render deployment
      if(
        origin.includes(".onrender.com")
      ){
        return callback(null,true);
      }


      // Development mode
      if(
        process.env.NODE_ENV !== "production"
      ){
        return callback(null,true);
      }


      console.log(
        "Blocked CORS origin:",
        origin
      );


      callback(
        new Error("Not allowed by CORS")
      );

    },


    credentials:true,


    methods:[
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS"
    ],


    allowedHeaders:[
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Admin-Token"
    ],


    optionsSuccessStatus:200,


    maxAge:86400

  })
);



/* =========================
 SECURITY MIDDLEWARE
========================= */


const {
  sanitizeMiddleware,
  limitBodySize
}=require("./middlewares/validation");


const {
  generateCsrfTokenMiddleware,
  csrfProtection
}=require("./middlewares/csrf");


const {
  auditMiddleware
}=require("./middlewares/audit");



app.use(sanitizeMiddleware);


app.use(
  limitBodySize("5mb")
);


app.use(
  generateCsrfTokenMiddleware
);

app.use(csrfProtection);

app.use(
  auditMiddleware
);



/* =========================
 MODELS
========================= */


const Tool=require("./models/Tool");

const BlogPost=require("./models/BlogPost");

const ErrorLog=require("./models/ErrorLog");

const Affiliate=require("./models/Affiliate");

const User=require("./models/User");



/* =========================
 ROUTES
========================= */


function createFallbackRouter(message = "Service temporarily unavailable") {
  const router = express.Router();
  router.all("*", (req, res) => {
    res.status(503).json({
      success: false,
      message
    });
  });
  return router;
}

function loadRoute(modulePath, fallbackMessage) {
  try {
    return require(modulePath);
  } catch (error) {
    console.warn(`Route load failed for ${modulePath}: ${error.message}`);
    return createFallbackRouter(fallbackMessage);
  }
}

const authRoute=loadRoute("./routes/auth", "Authentication service temporarily unavailable");

const toolsRoute=loadRoute("./routes/tools", "Tools service temporarily unavailable");

const contactRoute=loadRoute("./routes/contact", "Contact service temporarily unavailable");

const adminRoute=loadRoute("./routes/admin", "Admin service temporarily unavailable");

const analyticsRoute=loadRoute("./routes/analytics", "Analytics service temporarily unavailable");

const blogRoute=loadRoute("./routes/blog", "Blog service temporarily unavailable");

const businessRoute=loadRoute("./routes/business", "Business service temporarily unavailable");

const adsRoute=loadRoute("./routes/ads", "Ads service temporarily unavailable");



/* =========================
 RATE LIMIT
========================= */


const createLimiter=require("./middlewares/rateLimiter");
const isTestEnvironment = process.env.NODE_ENV === "test";

app.use(
 createLimiter({
   windowMs:60000,
   max:isTestEnvironment ? 1000 : 120
 })
);



const authLimiter=createLimiter({

 windowMs:15*60*1000,

 max:isTestEnvironment ? 200 : 5

});



/* =========================
 DATABASE CONNECTION
========================= */


const mongoUri =
process.env.MONGO_URI ||
null;



if(mongoUri){


 mongoose
 .connect(mongoUri)

 .then(()=>{
   console.log(
    "MongoDB Connected"
   );
 })

 .catch(err=>{

   console.warn(
    "MongoDB connection failed:",
    err.message
   );

 });


}else{


 console.warn(
  "MONGO_URI missing - running without database"
 );


}
/* =========================
   ADMIN ROUTES
========================= */

app.use(
  "/api/admin",
  adminRoute
);


/* =========================
   AUTH ROUTES
========================= */

app.use(
  "/api/auth",
  authLimiter,
  authRoute
);



/* =========================
   PUBLIC API ROUTES
========================= */


app.use(
  "/api/tools",
  toolsRoute
);


app.use(
  "/api/contact",
  contactRoute
);


app.use(
  "/api/analytics",
  analyticsRoute
);


app.use(
  "/api/blog",
  blogRoute
);


app.use(
  "/api/business",
  businessRoute
);


app.use(
  "/api/ads",
  adsRoute
);



/* =========================
   HEALTH CHECK
========================= */


const healthResponse = () => ({
  ok:true,

  status:"healthy",

  service:"smart-tools-platform",

  timestamp:new Date().toISOString(),

  database:
    mongoose.connection.readyState === 1
    ? "connected"
    : "disconnected"

});



app.get(
 "/health",
 (req,res)=>{
   res.json(
     healthResponse()
   );
 }
);



app.get(
 "/api/health",
 (req,res)=>{
   res.json(
     healthResponse()
   );
 }
);



/* =========================
   AFFILIATE REDIRECT SYSTEM
========================= */


app.get(
 "/go/:tool",
 async(req,res)=>{

  try{


    const record =
    await Affiliate.findOne({

      key:req.params.tool.toLowerCase(),

      active:true

    });



    if(!record){

      return res.redirect("/");

    }



    record.clicks =
      (record.clicks || 0)+1;



    await record.save();



    return res.redirect(
      record.affiliate_url ||
      record.base_url
    );



  }catch(error){

    console.error(
      "Affiliate error:",
      error
    );


    return res.redirect("/");

  }

});



/* =========================
   FRONTEND
========================= */


const frontendPath =
path.join(
 __dirname,
 "frontend"
);



app.get(
 ["/","/index.html"],
 (req,res)=>{

 res.sendFile(
   path.join(
    frontendPath,
    "index.html"
   )
 );

});



app.get(
 ["/admin","/admin.html"],
 (req,res)=>{

 res.sendFile(
  path.join(
   frontendPath,
   "admin.html"
  )
 );

});



app.use(
 express.static(
  frontendPath
 )
);



/* =========================
   HTML PAGE ROUTES
========================= */


const pages=[

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



pages.forEach(page=>{


 const route =
 "/"+page.replace(".html","");


 app.get(
  route,
  (req,res)=>{

   res.sendFile(
    path.join(
     frontendPath,
     page
    )
   );

  }
 );


});



app.get(
 ["/tools","/tools/"],
 (req,res)=>{

 res.sendFile(
  path.join(
   frontendPath,
   "tool.html"
  )
 );

});



app.get(
 ["/tools/:slug","/tools/:slug/"],
 (req,res)=>{

 res.sendFile(
  path.join(
   frontendPath,
   "tool.html"
  )
 );

});



app.get(
 ["/blog/:slug","/blog/:slug/"],
 (req,res)=>{

 res.sendFile(
  path.join(
   frontendPath,
   "blog-post.html"
  )
 );

});



/* =========================
   DOWNLOAD FILES
========================= */


app.use(
 "/download",
 express.static(
  path.join(
   __dirname,
   "converted"
  )
 )
);



/* =========================
   ROBOTS
========================= */


app.get(
 "/robots.txt",
 (req,res)=>{


 const baseUrl =
 `${req.protocol}://${req.get("host")}`;


 res.type(
  "text/plain"
 )
 .send(

`
User-agent: *
Disallow: /admin
Disallow: /api/admin
Allow: /

Sitemap: ${baseUrl}/sitemap.xml

`.trim()

 );


});



/* =========================
   SITEMAP
========================= */


app.get(
 "/sitemap.xml",
 (req,res)=>{


 const baseUrl =
 `${req.protocol}://${req.get("host")}`;



 const urls=[

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



 const xml=

`<?xml version="1.0" encoding="UTF-8"?>

<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls.map(url=>`

<url>

<loc>${baseUrl+url}</loc>

<priority>0.8</priority>

</url>

`).join("")}

</urlset>`;



 res.type(
  "application/xml"
 )
 .send(xml);



});



/* =========================
   OLD URL REDIRECTS
========================= */


const legacyToolPages={

 "/calculator.html":
 "calculator",

 "/bmi-calculator.html":
 "bmi-calculator",

 "/unit-converter.html":
 "unit-converter"

};



app.get(
 Object.keys(legacyToolPages),
 (req,res)=>{

 res.redirect(
 `/tool.html?slug=${legacyToolPages[req.path]}`
 );

});



/* =========================
   ERROR HANDLER
========================= */


app.use(
 (err,req,res,next)=>{


 console.error(
  "Server Error:",
  err.message
 );



 if(ErrorLog){

  ErrorLog.create({

   type:"server",

   message:err.message,

   stack:err.stack,

   path:req.originalUrl


  })
  .catch(()=>{});

 }



 res.status(500)
 .json({

  success:false,

  message:
  "Internal Server Error"

 });


});



/* =========================
   SHUTDOWN
========================= */


process.on(
 "SIGTERM",
 async()=>{


 console.log(
  "SIGTERM received"
 );


 if(
 mongoose.connection.readyState
 ){

 await mongoose.connection.close();

 }


 process.exit(0);


});



/* =========================
   START SERVER
========================= */


const PORT =
process.env.PORT || 5000;



if(require.main===module){


 app.listen(
  PORT,
  ()=>{

   console.log(
    `Server running on port ${PORT}`
   );

  }
 );


}



module.exports = app;
