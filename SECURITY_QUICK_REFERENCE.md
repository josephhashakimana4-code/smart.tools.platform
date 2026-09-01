# Security Quick Reference

## CSRF Protection Quick Setup

### For Developers Adding New Endpoints

#### 1. Standard Endpoint (Auto-Protected)
```javascript
// No additional setup needed - CSRF is automatic
router.post('/my-endpoint', authMiddleware, async (req, res) => {
  // CSRF validated automatically
  // Token available as: req.csrfToken
  // Level available as: req.csrfLevel ('critical', 'standard', 'default')
});
```

#### 2. Critical Endpoint (Fresh Token Required)
```javascript
const { requireStrictCsrf } = require('../middlewares/csrf-enhanced');

router.delete('/admin/users/:id', 
  authMiddleware, 
  requireStrictCsrf(),  // Add this
  async (req, res) => {
    // Must have token < 5 minutes old
  }
);
```

#### 3. Add to CSRF Config (if not in standard list)
Edit `middlewares/csrf-enhanced.js`:
```javascript
const endpointCsrfConfig = {
  critical: [
    "/api/admin/users",
    "/api/my-new-critical-endpoint"  // Add here
  ],
  standard: [
    "/api/tools",
    "/api/my-standard-endpoint"  // or here
  ]
};
```

---

## Second Verification Quick Setup

### For Developers Adding Sensitive Operations

#### 1. Simple Two-Factor Setup
```javascript
const { requireSecondVerification } = require('../middlewares/two-factor');

router.post('/email-change',
  authMiddleware,
  requireSecondVerification({ 
    operations: ['email-change'] 
  }),
  async (req, res) => {
    // Only called if user has verified via OTP
    // Verification info available as: req.verification
  }
);
```

#### 2. Client Flow
```javascript
// Step 1: Initiate verification
const initRes = await fetch('/api/auth/verification/initiate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ operation: 'email-change' })
});
const { sessionId } = await initRes.json();

// Step 2: Verify OTP (user enters code from email)
const verifyRes = await fetch('/api/auth/verification/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ sessionId, otp: userOtp })
});

// Step 3: Call endpoint with verification session
const opRes = await fetch('/api/email-change', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Verification-Session': sessionId,
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ newEmail: 'new@example.com' })
});
```

---

## API Endpoints Checklist

### CSRF Endpoints
- ✅ `GET /api/auth/csrf-token` - Get new CSRF token

### Verification Endpoints
- ✅ `POST /api/auth/verification/initiate` - Start OTP verification
- ✅ `POST /api/auth/verification/verify` - Verify OTP code
- ✅ `GET /api/auth/verification/status/:sessionId` - Check session status
- ✅ `POST /api/auth/verification/resend` - Resend OTP
- ✅ `POST /api/auth/verification/cancel` - Cancel verification

---

## Testing Checklist

### CSRF Testing
- [ ] Test POST without CSRF token → Should fail (403)
- [ ] Test POST with valid CSRF token → Should succeed
- [ ] Test POST with expired CSRF token → Should fail
- [ ] Test GET request → Should NOT require CSRF
- [ ] Test critical endpoint with standard token → Should fail
- [ ] Test critical endpoint with fresh token → Should succeed

### Verification Testing
- [ ] Initiate verification for email-change
- [ ] Verify with correct OTP
- [ ] Verify with incorrect OTP → Should fail
- [ ] Exceed max attempts (3) → Session should be locked
- [ ] Wait for OTP expiry (5 min) → Should fail
- [ ] Wait for session expiry (15 min) → Should fail
- [ ] Resend before 30s cooldown → Should fail
- [ ] Resend after 30s cooldown → Should succeed
- [ ] Cancel verification → Session should be consumed

---

## Debugging Tips

### CSRF Issues
```javascript
// Log CSRF info
console.log('CSRF Token:', req.csrfToken);
console.log('CSRF Level:', req.csrfLevel);
console.log('Token age:', Date.now() - csrfTokenData.createdAt);

// Check token in middleware
if (res.statusCode !== 200) {
  console.log('CSRF middleware skipped safety checks');
}
```

### Verification Issues
```javascript
// Log verification session
console.log('Verification session:', req.verification);
console.log('Session verified:', req.verification?.verified);
console.log('Operation:', req.verification?.metadata?.operation);

// Check OTP in development
// _testOtp is included in responses when NODE_ENV !== 'production'
```

---

## Common Error Responses

### CSRF Errors
```json
{
  "success": false,
  "message": "CSRF token missing",
  "code": "CSRF_MISSING"
}
```

```json
{
  "success": false,
  "message": "CSRF token expired",
  "code": "CSRF_EXPIRED"
}
```

```json
{
  "success": false,
  "message": "Fresh CSRF token required for this operation",
  "code": "CSRF_MUST_BE_FRESH"
}
```

### Verification Errors
```json
{
  "success": false,
  "message": "Second verification required for this operation",
  "code": "VERIFICATION_REQUIRED"
}
```

```json
{
  "success": false,
  "message": "Invalid OTP",
  "attemptsRemaining": 2
}
```

```json
{
  "success": false,
  "message": "Please wait before requesting a new code",
  "retryAfter": 30
}
```

---

## Environment Variables

```bash
# Security
NODE_ENV=development  # or production

# CSRF
CSRF_CRITICAL_TOKEN_EXPIRY=300000  # 5 minutes for critical ops

# Verification  
OTP_EXPIRY=300000           # 5 minutes
VERIFICATION_EXPIRY=900000  # 15 minutes
MAX_VERIFICATION_ATTEMPTS=3

# Email (for OTP delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# JWT
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
```

---

## Security Headers

The application automatically includes:
- ✅ HSTS (HTTP Strict Transport Security)
- ✅ X-Content-Type-Options (nosniff)
- ✅ X-Frame-Options (deny)
- ✅ Content-Security-Policy
- ✅ Referrer-Policy (strict-origin-when-cross-origin)
- ✅ Cross-Origin Resource Policy

No additional setup needed.

---

## Rate Limiting

Applied automatically:
- ✅ API: 100 requests/15 minutes (production)
- ✅ Auth: 5 requests/15 minutes (production)
- ✅ Verification: 5 requests/15 minutes (production)

Test environment: Unlimited (for testing)

---

## Key Files

- `middlewares/csrf-enhanced.js` - Enhanced CSRF protection
- `middlewares/two-factor.js` - OTP verification logic
- `routes/verification.js` - Verification API endpoints
- `server.js` - Main app setup
- `SECURITY_IMPLEMENTATION.md` - Full documentation

---

## Support

For security issues:
1. Do NOT create public GitHub issues for security vulnerabilities
2. Email: security@smarttoolshub.com
3. Allow 48 hours for response
