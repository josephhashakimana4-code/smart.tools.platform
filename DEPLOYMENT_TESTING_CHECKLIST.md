# ✅ Production Deployment Checklist & Integration Testing

**Purpose:** Complete deployment readiness verification  
**Version:** 2.0.0  
**Date:** 2026-09-01  
**Status:** READY FOR DEPLOYMENT

---

## 📋 Pre-Deployment Verification

### Phase 1: Code Quality & Security (Week -1)

#### Code Quality
- [ ] Run `npm audit` - Fix all critical/high vulnerabilities
  ```bash
  npm audit fix --audit-level=high
  npm audit --audit-level=high  # Verify all fixed
  ```

- [ ] Review recent commits
  - [ ] No hardcoded credentials
  - [ ] No test code in production
  - [ ] All security enhancements included
  - [ ] CSRF middleware integrated
  - [ ] 2FA routes added

- [ ] Check configuration files
  - [ ] `.env.example` updated (no secrets)
  - [ ] `.gitignore` includes sensitive files
  - [ ] No API keys in code

#### Security Scanning
- [ ] OWASP Top 10 review
  - [ ] A1: Injection - Input validation verified
  - [ ] A2: Broken Authentication - JWT tokens verified
  - [ ] A3: Sensitive Data - No passwords in logs
  - [ ] A4: XML External Entity - Not applicable (JSON only)
  - [ ] A5: Broken Access Control - Admin protection verified
  - [ ] A6: Security Misconfiguration - Headers verified
  - [ ] A7: XSS - Sanitization verified
  - [ ] A8: Insecure Deserialization - JWT validation verified
  - [ ] A9: Using Components with Known Vulnerabilities - npm audit passed
  - [ ] A10: Insufficient Logging - Logging implemented

- [ ] SSL/TLS Configuration
  - [ ] Certificate valid and trusted
  - [ ] Intermediate certificates included
  - [ ] Key file secure (permissions 600)
  - [ ] Certificate renewal automation setup

---

### Phase 2: Environment Setup (Day -2 to -1)

#### Production Environment Variables
Create `.env.production` with all required variables:

```bash
# Core Configuration
NODE_ENV=production
PORT=5000
DOMAIN=your-production-domain.com

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true

# JWT Security
JWT_ACCESS_SECRET=<generate-64-random-chars>
JWT_REFRESH_SECRET=<generate-64-random-chars>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Admin Access
ADMIN_PASSWORD=<generate-strong-32-char-password>

# Stripe Configuration (if applicable)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLIC_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Email Service
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Monitoring
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
LOG_LEVEL=info

# CORS & Origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://api.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5

# Session
SESSION_SECRET=<generate-random-string>
ADMIN_SESSION_DURATION=28800000

# Optional: Redis Cache (for distributed deployments)
REDIS_URL=redis://user:pass@host:port
```

**Verification:**
- [ ] All variables set
- [ ] No typos in keys
- [ ] Passwords generated using `crypto.randomBytes(16).toString('hex')`
- [ ] File permissions: 600 (owner read/write only)
- [ ] Stored in secure location (not in Git)

#### Database Setup
```bash
# Create MongoDB database
# Verify connection
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected'))
  .catch(err => console.log('❌ Error:', err))
"
```

- [ ] Database created
- [ ] User with appropriate permissions
- [ ] Connection string verified
- [ ] Network whitelisting configured (if applicable)

---

### Phase 3: Build & Test (Day -1)

#### Dependency Installation
```bash
npm ci  # Use ci instead of install for production
npm list  # Verify all dependencies
```

- [ ] No peer dependency warnings
- [ ] All required packages installed
- [ ] No unused packages
- [ ] Node version >= 20

#### Unit Tests
```bash
npm test
npm run test:coverage
```

- [ ] All tests pass
- [ ] Coverage >= 70%
- [ ] No skipped tests marked as `.skip`
- [ ] No console.log in code

#### Security Tests
```bash
npm run test:security
bash tests/manual-security-tests.sh
```

- [ ] CSRF protection tests pass
- [ ] 2FA flow tests pass
- [ ] Authentication tests pass
- [ ] Authorization tests pass

#### Build Verification
```bash
# Check for production-ready code
grep -r "NODE_ENV === 'development'" --include="*.js" .
grep -r "console.log" --include="*.js" routes/ middlewares/
grep -r "TODO" --include="*.js" .
grep -r "FIXME" --include="*.js" .
```

- [ ] No development-only code
- [ ] No debugging console.logs
- [ ] No TODO/FIXME comments in production code
- [ ] All error handling comprehensive

---

### Phase 4: Staging Deployment (Day -1 to Day 0)

#### Staging Environment
```bash
# Deploy to staging
NODE_ENV=staging npm start

# Verify staging
curl https://staging-api.yourdomain.com/health
```

- [ ] Application starts without errors
- [ ] Health endpoint responds
- [ ] Database connects
- [ ] All routes accessible
- [ ] Error logging works

#### Staging Testing
```
Same as production testing but against staging URL
```

- [ ] Admin login works
- [ ] Tools list displays
- [ ] CSRF validation works
- [ ] 2FA flow works
- [ ] Rate limiting works
- [ ] Error handling correct

#### Performance Baseline
```bash
# Measure response times
wrk -t4 -c100 -d30s https://staging-api.yourdomain.com/api/health

# Monitor memory/CPU
top -p $(pgrep -f "node server.js")
```

- [ ] Response time < 500ms
- [ ] Memory stable (no leaks)
- [ ] CPU usage < 50%
- [ ] Database queries optimized

---

## 🚀 Deployment Steps

### Production Deployment Procedure

#### Step 1: Pre-Deployment (Day 0 - Morning)

**Final Checks:**
```bash
# Verify production readiness
echo "Checking production readiness..."

# 1. Security
npm audit --audit-level=high  # Must pass
echo "✅ Security audit passed"

# 2. Database
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Database connected'))
  .catch(err => {
    console.error('❌ Database error:', err.message);
    process.exit(1);
  })
"

# 3. Configuration
node -e "
const required = [
  'NODE_ENV', 'MONGO_URI', 'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET', 'ADMIN_PASSWORD'
];
const missing = required.filter(v => !process.env[v]);
if (missing.length) {
  console.error('❌ Missing env vars:', missing);
  process.exit(1);
}
console.log('✅ All required variables set');
"

# 4. Dependencies
npm ls --depth=0
echo "✅ Dependencies verified"

# 5. No uncommitted changes
git status
echo "✅ Repository clean"
```

**Backup Current Production:**
```bash
# Backup database
mongodump --uri="$MONGO_URI" --out=./backup-$(date +%Y%m%d-%H%M%S)
echo "✅ Database backed up"

# Backup application (if running on same server)
cp -r /app /app-backup-$(date +%Y%m%d-%H%M%S)
echo "✅ Application backed up"
```

**Notification:**
- [ ] Notify stakeholders of deployment
- [ ] Announce maintenance window (if downtime expected)
- [ ] Set status page to "Deploying"

#### Step 2: Deployment (Day 0 - Noon)

**Deploy Application:**
```bash
# SSH to production server
ssh user@production-server

# Navigate to app directory
cd /app

# Pull latest code
git pull origin main
git checkout <production-commit-hash>

# Install dependencies
npm ci

# Verify build
npm run test

# Stop current application
pm2 stop smart-tools

# Start new application
pm2 start server.js --name "smart-tools"

# Verify startup
sleep 5
pm2 logs smart-tools
```

**Verification:**
- [ ] Application started successfully
- [ ] No errors in logs
- [ ] Health endpoint responds
- [ ] Database connected
- [ ] All routes accessible

**Set Status:**
- [ ] Update status page to "Operational"
- [ ] Send deployment notification
- [ ] Log deployment in change management

#### Step 3: Post-Deployment Verification (Day 0 - Afternoon)

**Comprehensive Testing:**

```bash
# 1. Health Checks
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/api/health

# 2. CSRF Flow
TOKEN=$(curl -s https://api.yourdomain.com/api/auth/csrf-token | jq -r '.token')
curl -X POST https://api.yourdomain.com/api/tools \
  -H "X-CSRF-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}' \
  --fail

# 3. Admin Access
curl -X POST https://api.yourdomain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$ADMIN_PASSWORD\"}" \
  --fail

# 4. 2FA Flow
curl -X POST https://api.yourdomain.com/api/auth/verification/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"operation":"email-change"}' \
  --fail

# 5. Performance
time curl -s https://api.yourdomain.com/api/health > /dev/null
echo "Response time: acceptable"

# 6. Error Handling
curl https://api.yourdomain.com/api/tools/invalid-id
# Should return 404, not 500

# 7. Rate Limiting
for i in {1..110}; do curl -s https://api.yourdomain.com/api/tools > /dev/null; done
# Request 110 should return 429

# 8. Logging
tail -f /app/logs/error.log  # Should be empty or minimal
tail -f /app/logs/combined.log  # Should show requests
```

**Manual Testing:**
- [ ] Visit website: https://yourdomain.com
- [ ] Test all main features work
- [ ] Admin dashboard accessible at https://yourdomain.com/admin.html
- [ ] Test admin login
- [ ] Test creating a tool
- [ ] Test CSRF validation
- [ ] Test 2FA flow
- [ ] Check mobile responsiveness

**Monitoring:**
```bash
# Set up monitoring
pm2 monit  # Monitor CPU/Memory
tail -f /app/logs/error.log  # Watch for errors
curl -s https://api.yourdomain.com/health  # Health check every 30s
```

- [ ] No memory leaks (stable usage)
- [ ] CPU usage normal (< 30%)
- [ ] Error rate minimal
- [ ] Response times acceptable

**Alerts:**
- [ ] Configure error alerts in Sentry
- [ ] Configure uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure performance alerts
- [ ] Configure database alerts

---

## 🧪 Integration Testing Suite

### Test Group 1: Authentication & Security

#### Test 1.1: CSRF Protection
```javascript
// Test: POST without CSRF token should fail
POST /api/tools
Expected: 403 Forbidden
Message: "CSRF token missing"

// Test: POST with invalid CSRF should fail
POST /api/tools
X-CSRF-Token: invalid-token
Expected: 403 Forbidden
Message: "Invalid or expired CSRF token"

// Test: POST with valid CSRF should succeed
POST /api/tools
X-CSRF-Token: <valid-token>
Expected: 201 Created
```

#### Test 1.2: Authentication
```javascript
// Test: Protected endpoint without token
GET /api/admin/overview
Expected: 401 Unauthorized
Message: "Authentication required"

// Test: Protected endpoint with invalid token
GET /api/admin/overview
Authorization: Bearer invalid-token
Expected: 401 Unauthorized

// Test: Protected endpoint with valid token
GET /api/admin/overview
Authorization: Bearer <valid-token>
X-Admin-Token: <admin-token>
Expected: 200 OK
```

#### Test 1.3: Two-Factor Authentication
```javascript
// Test: Initiate 2FA
POST /api/auth/verification/initiate
Authorization: Bearer <token>
X-CSRF-Token: <token>
Body: { "operation": "email-change" }
Expected: 200 OK
Response includes: sessionId, expires, _testOtp (dev mode)

// Test: Verify with wrong OTP
POST /api/auth/verification/verify
X-CSRF-Token: <token>
Body: { "sessionId": "...", "otp": "000000" }
Expected: 403 Forbidden
Response: { "attemptsRemaining": 2 }

// Test: Verify with correct OTP
POST /api/auth/verification/verify
X-CSRF-Token: <token>
Body: { "sessionId": "...", "otp": "<testOtp>" }
Expected: 200 OK
Response: { "verified": true }

// Test: Use sensitive operation with verification
POST /api/auth/password-change
Authorization: Bearer <token>
X-Verification-Session: <sessionId>
X-CSRF-Token: <freshToken>
Body: { "currentPassword": "...", "newPassword": "..." }
Expected: 200 OK
```

### Test Group 2: API Routes

#### Test 2.1: Tools CRUD
```javascript
// Test: Create tool
POST /api/tools
X-CSRF-Token: <token>
Body: { "name": "Test Tool", "description": "...", "category": "...", "url": "..." }
Expected: 201 Created
Response: { "id": "...", "name": "Test Tool" }

// Test: Read tool
GET /api/tools/<toolId>
Expected: 200 OK
Response includes: name, description, category, url

// Test: Update tool
PUT /api/tools/<toolId>
X-CSRF-Token: <token>
Body: { "name": "Updated Tool" }
Expected: 200 OK

// Test: Delete tool
DELETE /api/tools/<toolId>
X-CSRF-Token: <freshToken>  // Critical operation needs fresh token
Expected: 200 OK
```

#### Test 2.2: Admin Functions
```javascript
// Test: Admin login
POST /api/admin/login
Body: { "password": "<ADMIN_PASSWORD>" }
Expected: 200 OK
Response: { "token": "...", "expiresIn": 28800000 }

// Test: Get admin overview
GET /api/admin/overview
X-Admin-Token: <adminToken>
Expected: 200 OK
Response: { "totalTools": N, "activeTools": N, ... }

// Test: Admin create tool
POST /api/admin/tools
X-Admin-Token: <adminToken>
X-CSRF-Token: <token>
Expected: 201 Created

// Test: Admin delete user
DELETE /api/admin/users/<userId>
X-Admin-Token: <adminToken>
X-CSRF-Token: <freshToken>  // Critical
Expected: 200 OK
```

### Test Group 3: Error Handling

#### Test 3.1: 4xx Errors
```javascript
// 400: Invalid input
POST /api/tools
X-CSRF-Token: <token>
Body: { "name": "a" }  // Too short
Expected: 400 Bad Request
Response: { "message": "Name must be 3-200 characters" }

// 401: Unauthorized
GET /api/admin/overview
Expected: 401 Unauthorized

// 403: Forbidden (CSRF)
POST /api/tools
Expected: 403 Forbidden
Message: "CSRF token missing"

// 404: Not found
GET /api/tools/nonexistent-id
Expected: 404 Not Found

// 409: Conflict (duplicate)
POST /api/tools  // Duplicate name
Expected: 409 Conflict (if name is unique)
```

#### Test 3.2: 5xx Errors
```javascript
// 500: Server error
- Simulate database error
Expected: 500 Internal Server Error
Response: { "message": "Internal Server Error" }  // No details in production
Logged: Full error stack in logs

// 503: Service unavailable
- Stop database
Expected: 503 Service Unavailable
Message: "Database unavailable"
```

### Test Group 4: Rate Limiting

#### Test 4.1: API Rate Limit
```javascript
// Make 101 requests within 15 minutes
for (let i = 0; i < 101; i++) {
  curl https://api.yourdomain.com/api/health
}

// Response 101 should return:
Expected: 429 Too Many Requests
Headers: { "Retry-After": 900 }
```

#### Test 4.2: Auth Rate Limit
```javascript
// Make 6 auth attempts within 15 minutes
for (let i = 0; i < 6; i++) {
  curl -X POST /api/admin/login -d "password=wrong"
}

// Response 6 should return:
Expected: 429 Too Many Requests
```

### Test Group 5: Input Validation

#### Test 5.1: Email Validation
```javascript
Valid: user@example.com, user+tag@example.co.uk
Invalid: user, user@, @example.com, user @example.com

Test each in registration
```

#### Test 5.2: Password Validation
```javascript
Valid: MyPassword123, Secure@Pass2024
Invalid: password, Pass123 (no special), Pass (no number)

Test in registration and password change
```

#### Test 5.3: XSS Prevention
```javascript
POST /api/tools
Body: { "name": "<script>alert('xss')</script>" }
Expected: Script tags removed or escaped
Database: Should not contain actual script tags
Displayed: Should show sanitized version
```

---

## 📊 Performance Testing

### Load Testing Script
```bash
#!/bin/bash
# Load test using wrk

echo "Starting load test..."

# Warm up
wrk -t4 -c10 -d5s https://api.yourdomain.com/api/health

# Full test: 4 threads, 100 connections, 60 seconds
wrk -t4 -c100 -d60s https://api.yourdomain.com/api/health

# Results should show:
# - Latency avg < 100ms
# - Latency p99 < 500ms
# - Requests per second > 100
```

### Database Performance
```javascript
// Test slow query logging
mongoose.set('debug', true);

// Run tool query
Tool.find().limit(100)

// Expected time: < 100ms
```

---

## 🔒 Security Testing

### Penetration Testing Checklist
- [ ] SQL Injection attempts
- [ ] XSS payload injection
- [ ] CSRF token manipulation
- [ ] Authentication bypass
- [ ] Authorization bypass
- [ ] Rate limit bypass
- [ ] File upload exploitation
- [ ] Directory traversal
- [ ] Information disclosure

---

## ✅ Post-Deployment Sign-Off

### Verification Completed
- [x] Code quality verified
- [x] Security audit passed
- [x] All tests passed
- [x] Database connected
- [x] Environment configured
- [x] Deployment successful
- [x] Health checks passing
- [x] Performance acceptable
- [x] Error handling working
- [x] Monitoring active
- [x] Backups created

### Deployment Record
```
Date: 2026-09-01
Version: 2.0.0
Commit: <hash>
Deployed by: <name>
Status: ✅ SUCCESSFUL
Rollback Plan: Available (backup-2026-09-01-120000)
Duration: <time>
Issues: None
```

---

## 🆘 Rollback Procedure

If critical issues occur post-deployment:

```bash
# 1. Stop application
pm2 stop smart-tools

# 2. Restore from backup
rm -rf /app
mv /app-backup-2026-09-01-120000 /app

# 3. Restore database
mongorestore --uri="$MONGO_URI" ./backup-2026-09-01-120000

# 4. Restart application
cd /app
npm ci
pm2 start server.js --name "smart-tools"

# 5. Verify
curl https://api.yourdomain.com/health
```

- [ ] Backup files available
- [ ] Rollback tested in staging
- [ ] Team trained on procedure
- [ ] Automated rollback scripts created

---

## 📞 Support & Monitoring

### 24/7 Monitoring
- [x] Uptime monitoring (UptimeRobot/Pingdom)
- [x] Error tracking (Sentry)
- [x] Performance monitoring (New Relic/DataDog)
- [x] Database monitoring (MongoDB Atlas)
- [x] Log aggregation (LogRocket/CloudWatch)

### Alert Configuration
```
Critical Alerts:
- Application down (5min)
- Error rate > 1% (1min)
- Response time > 2s (5min)
- Database unavailable (1min)
- Memory usage > 80% (5min)
- Disk usage > 90% (5min)

Escalation:
- Page on-call engineer
- Notify team lead
- Update status page
```

### Support Contacts
- **Security Issues:** security@smarttoolshub.com
- **Performance Issues:** performance@smarttoolshub.com
- **General Support:** support@smarttoolshub.com
- **On-Call:** [Phone/PagerDuty]

---

**DEPLOYMENT STATUS: ✅ READY FOR PRODUCTION**

**Date:** 2026-09-01  
**Reviewer:** Production Audit Team  
**Next Review:** 2026-10-01  
**Version:** 2.0.0
