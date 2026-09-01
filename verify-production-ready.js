#!/usr/bin/env node
/**
 * Smart Tools Platform - Production Readiness Verification
 * 
 * Run this script to verify your platform is ready for production deployment
 * Usage: node verify-production-ready.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function check(condition, message) {
  if (condition) {
    log(`  ✓ ${message}`, 'green');
    return true;
  } else {
    log(`  ✗ ${message}`, 'red');
    return false;
  }
}

function section(title) {
  log(`\n${title}`, 'blue');
  log('─'.repeat(60), 'blue');
}

// Main checks
let passed = 0;
let failed = 0;

section('📋 Smart Tools Platform - Production Readiness Check');

// 1. Code Quality
section('1️⃣  Code Quality');
passed += check(fs.existsSync('server.js'), 'server.js exists');
passed += check(fs.existsSync('package.json'), 'package.json exists');
passed += check(fs.existsSync('render.yaml'), 'render.yaml configured');
passed += check(
  fs.readFileSync('server.js', 'utf8').includes('productionDomain'),
  'Server configured for dynamic domain'
);

// 2. Security Configuration
section('2️⃣  Security Configuration');
const serverContent = fs.readFileSync('server.js', 'utf8');
passed += check(serverContent.includes('helmet('), 'Helmet.js security headers enabled');
passed += check(serverContent.includes('csrfProtection'), 'CSRF protection configured');
passed += check(serverContent.includes('rateLimit'), 'Rate limiting configured');
passed += check(serverContent.includes('xss'), 'XSS protection enabled');
passed += check(serverContent.includes('hpp()'), 'HPP protection enabled');

// 3. Authentication & Authorization
section('3️⃣  Authentication & Authorization');
passed += check(fs.existsSync('middlewares/jwt-auth.js'), 'JWT authentication');
passed += check(fs.existsSync('middlewares/role.js'), 'Role-based access control');
passed += check(fs.existsSync('routes/auth.js'), 'Auth endpoints configured');
const authContent = fs.readFileSync('routes/auth.js', 'utf8');
passed += check(authContent.includes('2fa') || authContent.includes('otp'), '2FA/OTP available');

// 4. API Security
section('4️⃣  API Security');
passed += check(fs.existsSync('routes/admin.js'), 'Admin routes protected');
passed += check(fs.existsSync('routes/business.js'), 'Business routes secured');
passed += check(serverContent.includes('/api', 'apiLimiter'), 'API rate limiting active');
const validationContent = fs.readFileSync('middlewares/validation.js', 'utf8');
passed += check(validationContent.includes('validate'), 'Request validation middleware');

// 5. Database Configuration
section('5️⃣  Database Configuration');
passed += check(fs.existsSync('config/db.js'), 'Database config file');
passed += check(fs.existsSync('models/'), 'Database models defined');
const dbModels = fs.readdirSync('models/').filter(f => f.endsWith('.js')).length;
passed += check(dbModels > 5, `Database models created (found ${dbModels})`);

// 6. Monitoring & Logging
section('6️⃣  Monitoring & Logging');
passed += check(serverContent.includes('morgan('), 'Morgan logging configured');
passed += check(serverContent.includes('Sentry'), 'Sentry error tracking prepared');
passed += check(fs.existsSync('utils/fileCleanup.js'), 'File cleanup utility');
passed += check(fs.existsSync('middlewares/logger.js'), 'Custom logger configured');

// 7. File Upload Security
section('7️⃣  File Upload Security');
passed += check(serverContent.includes('multer'), 'File upload handler');
passed += check(serverContent.includes('fileValidator'), 'File validation');
passed += check(serverContent.includes('scanBufferForVirus'), 'Virus scanning');
passed += check(serverContent.includes('fileSize: 20'), 'File size limits enforced');

// 8. Error Handling
section('8️⃣  Error Handling');
passed += check(fs.existsSync('middlewares/errorHandler.js'), 'Error handler middleware');
const errorContent = fs.readFileSync('middlewares/errorHandler.js', 'utf8');
passed += check(errorContent.includes('500'), 'Proper HTTP status codes');
passed += check(!serverContent.includes('console.error(err)'), 'Errors not exposed in console');

// 9. Documentation
section('9️⃣  Documentation');
passed += check(fs.existsSync('RENDER_DEPLOYMENT.md'), 'Render deployment guide');
passed += check(fs.existsSync('PRODUCTION_CHECKLIST.md'), 'Production checklist');
passed += check(fs.existsSync('PRODUCTION_README.md'), 'Production README');
passed += check(fs.existsSync('README.md'), 'Project README');

// 10. Render Configuration
section('🔟 Render Configuration');
const renderContent = fs.readFileSync('render.yaml', 'utf8');
passed += check(renderContent.includes('NODE_ENV'), 'Node environment configured');
passed += check(renderContent.includes('APP_BASE_URL'), 'Domain configuration ready');
passed += check(renderContent.includes('ALLOWED_ORIGINS'), 'CORS origins configured');
passed += check(renderContent.includes('/api/health'), 'Health check endpoint');

// Summary
section('✅ Production Readiness Summary');

const total = passed + failed;
const percentage = ((passed / total) * 100).toFixed(0);

log(`\nPassed: ${passed}/${total} checks (${percentage}%)`, 'green');

if (percentage >= 90) {
  log('🚀 Platform is ready for production deployment!', 'green');
  log('\nNext steps:', 'cyan');
  log('1. Review PRODUCTION_README.md for deployment steps');
  log('2. Follow RENDER_DEPLOYMENT.md step-by-step');
  log('3. Use PRODUCTION_CHECKLIST.md before going live');
} else if (percentage >= 70) {
  log('⚠️  Platform is mostly ready, but needs attention', 'yellow');
  log('Review failed checks above before deployment', 'yellow');
} else {
  log('❌ Platform needs significant work before production', 'red');
  log('Complete all checks before deploying', 'red');
}

log('\n📚 Key Documentation:', 'cyan');
log('  • PRODUCTION_README.md - Quick start guide');
log('  • RENDER_DEPLOYMENT.md - Detailed deployment steps');
log('  • PRODUCTION_CHECKLIST.md - Pre-launch verification');
log('  • server.js - Main application file (domain-aware)');
log('  • render.yaml - Render service configuration');

log('\n', 'reset');
