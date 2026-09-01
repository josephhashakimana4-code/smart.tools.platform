# Smart Tools Platform - Production Setup Guide

## Quick Start for Production Deployment

**Status**: ✅ Ready for Production on Render with .COM Domain

This platform is fully configured for production deployment with enterprise-grade security, monitoring, and reliability.

---

## What's Configured for Production

### ✅ Security
- **CSRF Protection**: All state-changing operations protected
- **2FA/OTP Verification**: Second factor authentication for sensitive operations
- **Security Headers**: Helmet.js with strict CSP, HSTS, frame guards
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: XSS prevention, SQL injection protection
- **File Scanning**: Virus scanning on all uploads
- **Audit Logging**: All security events logged with timestamps

### ✅ Infrastructure
- **Render Deployment**: Pre-configured in `render.yaml`
- **SSL/TLS**: Auto-issued by Render (free)
- **Health Checks**: `/api/health` endpoint configured
- **Auto-scaling**: Ready for demand scaling
- **Monitoring**: Built-in with Sentry integration
- **Logging**: Structured logging with Winston

### ✅ Features
- **User Management**: Complete auth system with JWT
- **Admin Dashboard**: Full control panel with 2FA
- **Tool Conversion**: PDF/Word/Image converters with format preservation
- **Monetization**: Stripe integration for payments
- **Analytics**: Usage tracking and reporting
- **Blog System**: Content management with SEO
- **Affiliate Program**: Commission tracking system
- **Advertising**: Ad placement and tracking

### ✅ Database
- **MongoDB**: Multi-region support via Atlas
- **Indexes**: Optimized for production queries
- **Backups**: Daily automated backups
- **Connection Pooling**: Configured for high traffic

---

## Deployment Steps

### 1. **Prepare Your .COM Domain**
```
1. Purchase domain (GoDaddy, Namecheap, etc.)
2. Keep registrar dashboard open for DNS configuration
3. Note your domain for next steps
```

### 2. **Prepare Environment Variables**

Create these secrets in Render Dashboard (do NOT commit to GitHub):

```bash
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/smarttools
ADMIN_PASSWORD=YourStrongPassword123!
JWT_ACCESS_SECRET=random-32-char-secret-key-here
JWT_REFRESH_SECRET=another-random-32-char-secret-key
STRIPE_SECRET_KEY=sk_live_xxx...
STRIPE_PUBLISHABLE_KEY=pk_live_xxx...
STRIPE_WEBHOOK_SECRET=whsec_xxx...
SENTRY_DSN=https://xxx@sentry.io/yyy (optional)
REDIS_URL=redis://user:pass@host:port (optional)
```

### 3. **Update Domain in render.yaml**

Replace `yourdomain.com` with your actual domain:

```yaml
envVars:
  - key: APP_BASE_URL
    value: https://yourdomain.com
    
  - key: ALLOWED_ORIGINS
    value: https://yourdomain.com,https://www.yourdomain.com,https://admin.yourdomain.com
```

### 4. **Deploy to Render**

```bash
# 1. Push to GitHub
git add render.yaml
git commit -m "chore: production domain configuration"
git push origin main

# 2. Connect repository to Render
#    - Go to https://dashboard.render.com
#    - Click "New +" → "Web Service"
#    - Connect GitHub repository
#    - Select main branch

# 3. Configure service in Render Dashboard
#    - Name: smart-tools-platform
#    - Region: Oregon (or nearest)
#    - Plan: Standard (minimum for production)
#    - Node: 20+
#    - Build: npm install
#    - Start: npm start

# 4. Add all environment variables as secrets
#    - Do NOT paste into render.yaml
#    - Use Dashboard "Environment" section
```

### 5. **Configure DNS**

After Render deploys (5-10 minutes):

```bash
# Get your Render URL from Dashboard
# Example: smart-tools-platform-abc123.onrender.com

# In your domain registrar:
# 1. Add CNAME records:
#    @ (root) → smart-tools-platform-abc123.onrender.com
#    www → smart-tools-platform-abc123.onrender.com
#    admin → smart-tools-platform-abc123.onrender.com

# 2. Wait for DNS propagation (5-48 hours typically)

# 3. Verify with:
nslookup yourdomain.com
```

### 6. **Add Custom Domain in Render**

```
1. Service Dashboard → Settings → Custom Domains
2. Click "Add Custom Domain"
3. Enter: yourdomain.com
4. Render validates DNS and provisions SSL (5-30 minutes)
5. Status will show Active when ready
6. Repeat for www.yourdomain.com and admin.yourdomain.com
```

### 7. **Verify Deployment**

```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Expected response (JSON):
# {
#   "ok": true,
#   "status": "healthy",
#   "service": "smart-tools-platform",
#   "database": "connected"
# }

# Test homepage
curl -I https://yourdomain.com

# Should return 200 with security headers
```

### 8. **Configure Stripe Webhooks**

```bash
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: https://yourdomain.com/api/business/webhooks/stripe
3. Select events: 
   - checkout.session.completed
   - invoice.paid
   - customer.subscription.deleted
   - charge.refunded
4. Copy signing secret
5. Set STRIPE_WEBHOOK_SECRET in Render
```

### 9. **Set Up Monitoring**

```bash
# Sentry (Error Tracking)
1. Create account at sentry.io
2. Create Node.js project
3. Copy DSN
4. Set SENTRY_DSN in Render environment

# Render Alerts
1. Service → Settings → Alerts
2. Enable CPU, Memory, Build alerts
3. Add notification channels (email, Slack)

# Status Page (Optional)
1. Create public status page in Render
2. Share with users/customers
```

---

## Important Files

| File | Purpose |
|------|---------|
| `render.yaml` | Render deployment configuration (update domain here) |
| `RENDER_DEPLOYMENT.md` | Step-by-step deployment guide |
| `PRODUCTION_CHECKLIST.md` | Complete pre-launch checklist |
| `server.js` | Express app with security headers (domain-aware) |
| `routes/` | API endpoints (secure, validated) |
| `middlewares/` | Security middleware (CSRF, 2FA, audit, rate limit) |
| `models/` | Database schemas (MongoDB) |

---

## Environment Variables Reference

### Required for Production
```bash
NODE_ENV=production                    # Always 'production'
APP_BASE_URL=https://yourdomain.com   # Your .com domain
MONGO_URI=mongodb+srv://...            # MongoDB connection
ADMIN_PASSWORD=<secure-password>       # Admin login password
JWT_ACCESS_SECRET=<random-key>         # JWT signing key (32+ chars)
JWT_REFRESH_SECRET=<random-key>        # Refresh token signing key
STRIPE_SECRET_KEY=sk_live_...          # Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...        # Stripe webhook signing secret
```

### Recommended for Production
```bash
SENTRY_DSN=https://...@sentry.io/...  # Error tracking
REDIS_URL=redis://...                  # Session/cache store
LOG_LEVEL=info                         # Logging verbosity
ENABLE_2FA=true                        # 2FA enforcement
ENABLE_CSRF=true                       # CSRF protection
```

### Optional
```bash
S3_BUCKET=your-bucket                  # AWS S3 for file storage
S3_REGION=us-east-1                    # AWS region
AWS_ACCESS_KEY_ID=xxx                  # AWS credentials
AWS_SECRET_ACCESS_KEY=xxx              # AWS credentials
ALLOWED_ORIGINS=https://yourdomain.com # CORS origins
```

---

## Security Checklist Before Launch

- [ ] ADMIN_PASSWORD changed from default
- [ ] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are unique, random, 32+ characters
- [ ] MONGO_URI uses strong password
- [ ] STRIPE_SECRET_KEY is from production (sk_live_*)
- [ ] DATABASE backups enabled and tested
- [ ] SSL certificate active (green padlock in browser)
- [ ] No console.log() statements with sensitive data
- [ ] 2FA enabled for all admin accounts
- [ ] Rate limiting tested (should block after 100 requests/15min)
- [ ] CSRF tokens being issued
- [ ] Security headers present in response

---

## Monitoring & Maintenance

### Daily
- ✓ Check `/api/health` endpoint
- ✓ Review Sentry for new errors
- ✓ Monitor Render dashboard metrics

### Weekly
- ✓ Review security audit logs
- ✓ Check database performance
- ✓ Verify SSL certificate still valid

### Monthly
- ✓ Run `npm audit` and fix vulnerabilities
- ✓ Test database backup restore
- ✓ Review and optimize slow queries
- ✓ Rotate JWT secrets (optional but recommended)

### Quarterly
- ✓ Security penetration testing
- ✓ Update dependencies
- ✓ Review and update CSP policy
- ✓ Audit admin user access

---

## Troubleshooting

### Domain not working
```bash
# Check DNS
nslookup yourdomain.com
dig yourdomain.com CNAME

# Check SSL certificate
curl -vI https://yourdomain.com

# Logs: Render Dashboard → Logs
```

### Database connection failing
```bash
# Test MongoDB URI locally
node -e "require('mongoose').connect(process.env.MONGO_URI)"

# Check:
# 1. Username/password correct
# 2. IP whitelist (allow 0.0.0.0/0 for Render)
# 3. Database exists
# 4. Network connectivity
```

### High error rate
```bash
# Check Sentry dashboard
# Check Render logs
# Look for:
# - Database connection errors
# - Out of memory
# - Unhandled promises
# - Missing environment variables
```

### Slow response times
```bash
# Check Render metrics
# Check database slow query logs
# Review API performance
# Consider upgrade to higher plan
```

---

## Deployment Rollback

If deployment has critical issues:

```bash
1. Render Dashboard → Service → Deployments
2. Find previous working deployment
3. Click "..." → "Redeploy"
4. Service will rollback to that version
5. Investigate issue in code
6. Fix and deploy again
```

---

## Support & Documentation

- **Render Docs**: https://render.com/docs
- **MongoDB Atlas**: https://docs.atlas.mongodb.com
- **Express.js Security**: https://expressjs.com/en/advanced/best-practice-security.html
- **Stripe API**: https://stripe.com/docs/api
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/nodejs-performance/

---

## Success Indicators

✅ **Everything is working correctly when you see:**

1. `curl https://yourdomain.com/api/health` returns 200 with health status
2. Homepage loads at `https://yourdomain.com`
3. SSL certificate is active (green padlock)
4. Admin panel accessible at `https://yourdomain.com/admin.html`
5. All tools functional (file uploads, conversions, etc.)
6. No errors in Sentry dashboard
7. Database shows "connected" in health check
8. Security headers present in HTTP responses
9. CSRF tokens being generated
10. Rate limiting working (test with many requests)

---

## Quick Reference: Important URLs After Deployment

```
Homepage:          https://yourdomain.com
Admin Panel:       https://yourdomain.com/admin.html
API Health:        https://yourdomain.com/api/health
Tools API:         https://yourdomain.com/api/tools
Status Page:       [Configured in Render]
Render Dashboard:  https://dashboard.render.com
Sentry Errors:     https://sentry.io/[your-project]
MongoDB Atlas:     https://cloud.mongodb.com
Stripe Dashboard:  https://dashboard.stripe.com
```

---

**Ready to deploy? Follow RENDER_DEPLOYMENT.md for detailed step-by-step instructions.**

**Questions? See PRODUCTION_CHECKLIST.md for comprehensive pre-launch verification.**

**Status**: ✅ Production Ready | 🔒 Security Hardened | 📊 Monitored | ⚡ Scalable

Last Updated: 2024-09-01
