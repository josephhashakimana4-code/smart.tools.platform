#!/usr/bin/env node
/**
 * Update server.js with production domain support
 * Allows the same server configuration to work with any domain
 * by reading APP_BASE_URL environment variable
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// Check if already updated
if (content.includes('productionDomain')) {
  console.log('✓ Server already configured for production domain support');
  process.exit(0);
}

// Step 1: Add domain extraction after allowUnsafeInline constant
const domainConfigCode = `
// Production domain configuration from APP_BASE_URL
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
let productionDomain = "localhost";
try {
  const url = new URL(appBaseUrl);
  productionDomain = url.hostname;
} catch (e) {
  console.warn("Invalid APP_BASE_URL, using localhost");
}
`;

const allowUnsafeInlinePattern = /const allowUnsafeInline = process\.env\.NODE_ENV !== "production";\n\napp\.use\(/;
if (allowUnsafeInlinePattern.test(content)) {
  content = content.replace(
    allowUnsafeInlinePattern,
    `const allowUnsafeInline = process.env.NODE_ENV !== "production";${domainConfigCode}\napp.use(`
  );
  console.log('✓ Added production domain extraction');
} else {
  console.warn('⚠ Could not find insertion point for domain configuration');
}

// Step 2: Update connectSrc to include production domain
const connectSrcPattern = /connectSrc: \[\s*"'self'",\s*"https:\/\/\*\.app\.github\.dev",\s*"https:\/\/\*\.onrender\.com"\s*\],/;
const connectSrcReplacement = `connectSrc: [
          "'self'",
          \`https://\${productionDomain}\`,
          \`https://www.\${productionDomain}\`,
          \`https://admin.\${productionDomain}\`,
          "https://*.app.github.dev",
          "https://*.onrender.com"
        ],`;

if (connectSrcPattern.test(content)) {
  content = content.replace(connectSrcPattern, connectSrcReplacement);
  console.log('✓ Updated connectSrc CSP directive');
} else {
  console.warn('⚠ Could not find connectSrc pattern to update');
}

// Step 3: Update CORS to include production domain
const corsPattern = /const allowedOrigins = \[\s*\.\.\.defaultOrigins,\s*\.\.\.envOrigins\s*\];/;
const corsReplacement = `const allowedOrigins = [
  ...defaultOrigins,
  ...envOrigins,
  appBaseUrl,
  \`https://\${productionDomain}\`,
  \`https://www.\${productionDomain}\`,
  \`https://admin.\${productionDomain}\`
];`;

if (corsPattern.test(content)) {
  content = content.replace(corsPattern, corsReplacement);
  console.log('✓ Updated CORS allowed origins');
} else {
  console.warn('⚠ Could not find CORS pattern to update');
}

// Write updated content
fs.writeFileSync(serverPath, content, 'utf8');
console.log('✓ server.js updated successfully for production domain support');
console.log('');
console.log('Next steps:');
console.log('1. Set APP_BASE_URL environment variable in Render dashboard');
console.log('2. Point your .com domain DNS to Render service');
console.log('3. Deploy and verify the domain in your browser');
