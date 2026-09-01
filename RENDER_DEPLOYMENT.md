# Render Deployment Guide - Production .COM Domain Setup

## Overview
This guide walks you through deploying Smart Tools Platform on Render with a production .com domain. The platform is fully configured for production security, monitoring, and reliability.

---

## Pre-Deployment Checklist

### Prerequisites
- [ ] GitHub account with repository access
- [ ] Render account (render.com)
- [ ] Domain name (.com or similar)
- [ ] Domain registrar access (GoDaddy, Namecheap, etc.)
- [ ] MongoDB Atlas account or external MongoDB instance
- [ ] Stripe account (for monetization features)

### Verify Local Configuration
```bash
# Ensure all tests pass
npm test

# Verify security configuration
npm run test:security

# Check for vulnerabilities
npm audit
```

---

## Step 1: Prepare Environment Variables

These environment variables must be set in the Render Dashboard. **Do NOT commit secrets to GitHub.**

### Required Secrets (Set in Render Dashboard)
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/smarttools?retryWrites=true&w=majority
ADMIN_PASSWORD=<strong-password-minimum-16-chars>
JWT_ACCESS_SECRET=<random-256-bit-key>
JWT_REFRESH_SECRET=<random-256-bit-key>
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SENTRY_DSN=https://xxx@sentry.io/yyy
REDIS_URL=redis://username:password@host:port
```

### Public Configuration (Set in render.yaml)
```
APP_BASE_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://admin.yourdomain.com
NODE_ENV=production
```

---

## Step 2: Configure Render Service

### Option A: Deploy Using render.yaml (Recommended)

1. **Push Configuration to GitHub**
   ```bash
   git add render.yaml
   git commit -m "chore: production render configuration"
   git push origin main
   ```

2. **Connect Repository to Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the branch (main)

3. **Configure Service**
   - **Name**: `smart-tools-platform`
   - **Region**: `Oregon` (or nearest to users)
   - **Plan**: `Standard` (minimum for production)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node Version**: `20` or higher

4. **Set Environment Variables**
   - Click "Advanced" → "Environment"
   - Paste all secrets from "Required Secrets" above
   - Click "Add Service"

### Option B: Manual Configuration

1. Go to Render Dashboard
2. Create new Web Service
3. Connect GitHub repository
4. Configure as described above in service settings
5. Add all environment variables in service settings

---

## Step 3: Configure Custom Domain

### 3.1 Get Render Service URL
After deployment completes:
1. Open your Render service dashboard
2. Copy the auto-generated URL (e.g., `smart-tools-platform-xxx.onrender.com`)
3. Note this for DNS configuration

### 3.2 Update DNS Records

#### With Your Domain Registrar (GoDaddy, Namecheap, etc.):

1. **Log in** to your domain registrar
2. **Find DNS Settings** (usually under Domain Settings or DNS Management)
3. **Add CNAME Record**:
   ```
   Type: CNAME
   Name: @ (or leave blank for root)
   Value: smart-tools-platform-xxx.onrender.com
   TTL: 3600 (or Auto)
   ```

4. **Add WWW Subdomain** (optional, recommended):
   ```
   Type: CNAME
   Name: www
   Value: smart-tools-platform-xxx.onrender.com
   TTL: 3600 (or Auto)
   ```

5. **Add Admin Subdomain** (optional):
   ```
   Type: CNAME
   Name: admin
   Value: smart-tools-platform-xxx.onrender.com
   TTL: 3600 (or Auto)
   ```

### 3.3 Point Domain to Render

In Render Dashboard:
1. Open your service → "Settings"
2. Scroll to "Custom Domains"
3. Click "Add Custom Domain"
4. Enter: `yourdomain.com`
5. Render will validate DNS and provision SSL certificate (auto, free)
6. Repeat for `www.yourdomain.com` and `admin.yourdomain.com`

### 3.4 Wait for SSL Certificate
- SSL provisioning takes 5-30 minutes
- Status will show "Pending" → "Active"
- Your domain will automatically redirect to HTTPS

---

## Step 4: Update Application Configuration

### 4.1 Update render.yaml

```yaml
envVars:
  - key: APP_BASE_URL
    value: https://yourdomain.com  # ← Update this
    
  - key: ALLOWED_ORIGINS
    value: https://yourdomain.com,https://www.yourdomain.com,https://admin.yourdomain.com
```

### 4.2 Commit Changes

```bash
git add render.yaml
git commit -m "chore: update production domain configuration"
git push origin main
```

This will trigger a new deployment with the correct domain configuration.

---

## Step 5: Verify Deployment

### 5.1 Check Service Status
```bash
curl https://yourdomain.com/api/health
```

Expected response:
```json
{
  "ok": true,
  "status": "healthy",
  "service": "smart-tools-platform",
  "timestamp": "2024-09-01T12:34:56.789Z",
  "database": "connected"
}
```

### 5.2 Test Core Features

1. **Homepage**: `https://yourdomain.com`
   - Page loads without errors
   - All CSS and JS assets load

2. **Tools API**: `https://yourdomain.com/api/tools`
   - Returns list of available tools
   - Proper CORS headers present

3. **Admin Panel**: `https://yourdomain.com/admin.html`
   - Login page displays
   - CSS loads correctly

4. **PDF Conversion**: `https://yourdomain.com/pdf-to-word.html`
   - Upload form works
   - No console errors

5. **Security Headers**: 
   ```bash
   curl -I https://yourdomain.com
   ```
   Look for:
   - `Strict-Transport-Security` ✓
   - `Content-Security-Policy` ✓
   - `X-Frame-Options: DENY` ✓
   - `X-Content-Type-Options: nosniff` ✓

### 5.3 Check Logs
```bash
# In Render Dashboard:
# Service → Logs
# Look for any errors or warnings
# Should see: "Server running on port 10000" or similar
```

---

## Step 6: Production Hardening

### 6.1 Configure Monitoring
1. **Sentry Integration**:
   - Create Sentry account at sentry.io
   - Create project for Node.js
   - Get DSN from project settings
   - Set `SENTRY_DSN` environment variable in Render
   - Errors will now be tracked automatically

2. **Render Alerts**:
   - Go to Service → Settings → Alerts
   - Enable CPU, Memory, and Build alerts
   - Set Slack/email notifications

### 6.2 Enable Database Backups
1. **MongoDB Atlas Backups**:
   - Go to Atlas Dashboard
   - Cluster → Backup
   - Enable automatic backups (daily)
   - Test restore procedure

### 6.3 Configure Rate Limiting
Rate limiting is already configured in `server.js`:
- 100 requests per 15 minutes per IP
- Applies to `/api/*` endpoints
- Adjust in `server.js` if needed

### 6.4 Enable Security Features
All features are enabled by default:
- ✓ CSRF protection
- ✓ 2FA for admin accounts
- ✓ JWT authentication
- ✓ Request validation
- ✓ SQL injection prevention
- ✓ XSS protection
- ✓ Security audit logging

---

## Step 7: Configure Stripe Webhooks

### 7.1 Add Webhook Endpoint to Stripe

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add an endpoint"
3. **Endpoint URL**: `https://yourdomain.com/api/business/webhooks/stripe`
4. **Events to send**:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.deleted`
   - `charge.refunded`
5. **Copy Signing Secret**
6. Set `STRIPE_WEBHOOK_SECRET` in Render environment variables

---

## Step 8: Performance Optimization

### 8.1 Enable Caching
- Browser caching is configured via Helmet
- Static assets have `Cache-Control` headers
- Consider adding Cloudflare CDN for global caching

### 8.2 Database Optimization
- MongoDB indexes are created automatically
- Consider connection pooling if high traffic
- Monitor slow queries in MongoDB Atlas

### 8.3 Content Delivery
- Consider Cloudflare Free CDN
- Enables caching, DDoS protection, and compression
- Can be added without changing Render configuration

---

## Step 9: Ongoing Maintenance

### Daily
- [ ] Monitor error logs in Sentry
- [ ] Check uptime (Render Dashboard)
- [ ] Monitor disk usage

### Weekly
- [ ] Review security logs (audit middleware)
- [ ] Check SSL certificate expiry (auto-renewed)
- [ ] Review failed login attempts in admin panel

### Monthly
- [ ] Run security audit: `npm audit`
- [ ] Update dependencies: `npm update`
- [ ] Review and optimize slow API endpoints
- [ ] Test database backup restore process

### Quarterly
- [ ] Security penetration testing
- [ ] Review CSP and CORS policies
- [ ] Update Stripe API version if needed
- [ ] Review and rotate JWT secrets

---

## Troubleshooting

### Domain not resolving
```bash
# Check DNS propagation
nslookup yourdomain.com
dig yourdomain.com
```
- DNS can take up to 48 hours
- Check CNAME record in registrar is correct
- Verify domain in Render Dashboard

### SSL Certificate not issued
- Ensure CNAME record is correct
- Wait 30 minutes for Render to detect DNS
- Check Render Dashboard > Custom Domains for status

### Service failing on startup
1. Check logs: Render Dashboard → Logs
2. Common issues:
   - Missing environment variables (check secrets)
   - Database connection failed (check MONGO_URI)
   - Node version mismatch
3. Roll back to previous deployment if needed

### High response times
1. Check Render metrics: Service → Metrics
2. Check database performance
3. Review slow API logs
4. Consider upgrading to higher plan

### Database connection errors
- Verify MONGO_URI is correct
- Check MongoDB Atlas IP whitelist (allow 0.0.0.0/0 for Render)
- Verify credentials in MONGO_URI
- Test connection locally with same URI

---

## Rolling Back Deployment

### If deployment has issues:
1. Render Dashboard → Service
2. Click "Deployments"
3. Find previous working deployment
4. Click "..." → "Rollback"
5. Confirm rollback

---

## Success Indicators

Once deployed, you should see:

✅ Homepage loads at `https://yourdomain.com`
✅ Health check returns 200: `https://yourdomain.com/api/health`
✅ SSL certificate active (green padlock)
✅ Admin panel accessible at `https://yourdomain.com/admin.html`
✅ All tools functional
✅ No errors in Sentry
✅ Database connected
✅ Rate limiting active (test with many requests)
✅ CSRF tokens being issued
✅ 2FA working for admin accounts

---

## Support & Additional Resources

- **Render Docs**: https://render.com/docs
- **Node.js Best Practices**: https://nodejs.org/en/docs/
- **Express.js Security**: https://expressjs.com/en/advanced/best-practice-security.html
- **MongoDB Atlas**: https://docs.atlas.mongodb.com/
- **Stripe API**: https://stripe.com/docs/api

---

## Emergency Contacts

- **Render Support**: support@render.com
- **MongoDB Support**: support@mongodb.com
- **Stripe Support**: https://support.stripe.com

---

**Deployment Date**: [Insert date]
**Production URL**: https://yourdomain.com
**Admin Panel**: https://yourdomain.com/admin.html
**Status Dashboard**: [Configure monitoring URL]
