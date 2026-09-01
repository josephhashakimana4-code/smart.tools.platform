# Security Implementation Guide

## Overview

This document outlines the comprehensive security measures implemented in the Smart Tools Platform, including:
1. **CSRF (Cross-Site Request Forgery) Protection** on all state-changing endpoints
2. **Second Verification** (OTP-based Two-Factor Authentication) for sensitive operations
3. **Request Signing** for critical operations
4. **Enhanced Token Management**

---

## 1. CSRF Protection

### Current Implementation

CSRF protection is automatically applied to all state-changing requests (POST, PUT, DELETE, PATCH) using the `csrfProtection` middleware in `server.js`.

### Exempt Endpoints

The following endpoints are exempt from CSRF validation:
- `POST /api/auth/register` - Public registration
- `POST /api/auth/login` - Public login
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/csrf-token` - CSRF token generation
- `POST /api/business/webhooks/stripe` - Stripe webhook
- `POST /api/contact` - Public contact form
- `GET /health` - Health check
- `GET /api/health` - API health check

### Token Lifecycle

#### For Standard Operations (15 min - 1 hour):
```javascript
POST /api/tools
PUT /api/blog/:id
DELETE /api/ads/:id
```

#### For Critical Operations (5-15 minutes):
```javascript
POST /api/admin/users
PUT /api/auth/password-change
DELETE /api/user/account
POST /api/business/payment
```

### Client Implementation

#### Step 1: Get CSRF Token
```javascript
// Method 1: From endpoint
const response = await fetch('/api/auth/csrf-token', {
  method: 'GET',
  credentials: 'include'
});
const { token } = await response.json();

// Method 2: From response header
const csrfToken = response.headers.get('X-CSRF-Token');
```

#### Step 2: Include Token in Requests
```javascript
// In request headers
const response = await fetch('/api/tools', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  credentials: 'include',
  body: JSON.stringify({
    name: 'My Tool',
    description: 'Tool description'
  })
});
```

#### Step 3: Refresh Token for Critical Operations
```javascript
// Before critical operations, get a fresh token
const freshToken = await fetch('/api/auth/csrf-token', {
  method: 'GET',
  credentials: 'include'
});
const { token } = await freshToken.json();

// Use fresh token for critical operation
await fetch('/api/auth/password-change', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token,
    'X-Operation': 'password-change'
  },
  body: JSON.stringify({
    currentPassword: 'old_pass',
    newPassword: 'new_pass'
  })
});
```

### Enhanced CSRF Configuration

Located in `middlewares/csrf-enhanced.js`:

```javascript
const endpointCsrfConfig = {
  critical: [
    "/api/admin/users",
    "/api/auth/password-change",
    "/api/user/delete-account"
  ],
  standard: [
    "/api/tools",
    "/api/blog",
    "/api/ads"
  ],
  exempt: [
    "/api/auth/register",
    "/api/contact"
  ]
};
```

---

## 2. Second Verification (OTP-based 2FA)

### When Second Verification is Required

Critical operations that require OTP verification:
- Email address changes
- Password changes
- Account deletion
- Admin user management
- Payment transactions
- Settings modifications

### Verification Flow

```
1. User initiates sensitive operation
   ↓
2. System requests second verification
   ↓
3. User calls: POST /api/auth/verification/initiate
   ↓
4. OTP sent via email (5-minute expiry)
   ↓
5. User receives OTP and calls: POST /api/auth/verification/verify
   ↓
6. Session marked as verified
   ↓
7. User calls original operation with verification session ID
   ↓
8. Operation completes, session consumed
```

### API Endpoints

#### 1. Initiate Verification
```
POST /api/auth/verification/initiate
Authorization: Bearer <token>
Content-Type: application/json

{
  "operation": "email-change",
  "type": "otp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to your email",
  "sessionId": "abc123def456...",
  "expires": 1672531200000,
  "type": "otp",
  "_testOtp": "123456"  // Only in development
}
```

#### 2. Verify OTP
```
POST /api/auth/verification/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "abc123def456...",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification successful",
  "sessionId": "abc123def456...",
  "verified": true,
  "operation": "email-change",
  "expiresIn": 600000
}
```

#### 3. Check Verification Status
```
GET /api/auth/verification/status/:sessionId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123def456...",
  "verified": true,
  "operation": "email-change",
  "attempts": 1,
  "maxAttempts": 3,
  "expiresIn": 300000,
  "type": "otp"
}
```

#### 4. Resend OTP
```
POST /api/auth/verification/resend
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "abc123def456..."
}
```

#### 5. Cancel Verification
```
POST /api/auth/verification/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "abc123def456..."
}
```

### Client Implementation Example

```javascript
// Step 1: Initiate verification for email change
const initResponse = await fetch('/api/auth/verification/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    operation: 'email-change',
    type: 'otp'
  })
});

const { sessionId, _testOtp } = await initResponse.json();

// Step 2: User enters OTP from email
// (In development, use _testOtp for testing)
const verifyResponse = await fetch('/api/auth/verification/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sessionId: sessionId,
    otp: userEnteredOtp
  })
});

const { verified } = await verifyResponse.json();

// Step 3: Call the sensitive operation with verification session
if (verified) {
  const changeEmailResponse = await fetch('/api/auth/email-change', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Verification-Session': sessionId,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      newEmail: 'newemail@example.com'
    })
  });
}
```

### Security Constraints

- **OTP Validity**: 5 minutes
- **Verification Session**: 15 minutes
- **Max Attempts**: 3 incorrect attempts per session
- **Resend Cooldown**: 30 seconds between resend requests
- **Token Binding**: Verification sessions are bound to the initiating user

---

## 3. Implementing Security on New Endpoints

### Adding CSRF Protection to New Routes

```javascript
// routes/my-feature.js
const router = express.Router();
const { authMiddleware } = require('../middlewares/jwt-auth');
const { requireStrictCsrf } = require('../middlewares/csrf-enhanced');

// Standard endpoint - uses global CSRF protection
router.post('/create', authMiddleware, async (req, res) => {
  // CSRF automatically validated
});

// Critical endpoint - requires fresh CSRF token
router.put('/critical', 
  authMiddleware, 
  requireStrictCsrf(),
  async (req, res) => {
    // Requires CSRF token less than 5 minutes old
  }
);
```

### Adding Second Verification to Sensitive Operations

```javascript
const router = express.Router();
const { authMiddleware } = require('../middlewares/jwt-auth');
const { requireSecondVerification } = require('../middlewares/two-factor');

// Require verification for admin delete
router.delete('/admin/users/:id',
  authMiddleware,
  requireSecondVerification({
    operations: ['admin:user-delete'],
    exceptions: ['/public']
  }),
  async (req, res) => {
    // Only proceeds if user has verified via OTP
    const verificationSession = req.verification;
    console.log('Verified operation:', verificationSession.type);
  }
);
```

### Server Setup

Register the verification routes in `server.js`:

```javascript
const verificationRoute = require('./routes/verification');
app.use('/api/auth/verification', verificationRoute);
```

---

## 4. Security Best Practices

### Do's ✅

1. **Always use HTTPS** in production
2. **Get fresh CSRF tokens** for critical operations
3. **Implement rate limiting** on verification endpoints
4. **Log security events** for audit trails
5. **Use secure headers** (already configured with Helmet)
6. **Validate all inputs** server-side
7. **Expire tokens appropriately** (already configured)
8. **Bind verification** to user sessions

### Don'ts ❌

1. **Don't** expose CSRF tokens in URLs (only headers/body)
2. **Don't** transmit tokens over insecure connections
3. **Don't** store OTP values in logs
4. **Don't** reuse verification sessions across operations
5. **Don't** skip CSRF for "internal" APIs
6. **Don't** extend OTP expiry beyond 5 minutes
7. **Don't** allow unlimited verification attempts

---

## 5. Testing Security Features

### CSRF Token Testing

```bash
# Get CSRF token
curl -i http://localhost:5000/api/auth/csrf-token

# Valid request with CSRF token
curl -X POST http://localhost:5000/api/tools \
  -H "X-CSRF-Token: <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'

# Invalid request without CSRF token
curl -X POST http://localhost:5000/api/tools \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
# Should return 403 Forbidden
```

### Second Verification Testing

```bash
# Initiate verification
curl -X POST http://localhost:5000/api/auth/verification/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"operation":"email-change"}'

# Response includes _testOtp in development
# Use _testOtp for verification

# Verify OTP
curl -X POST http://localhost:5000/api/auth/verification/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<sessionId>","otp":"<testOtp>"}'
```

---

## 6. Environment Variables

```bash
# CSRF Configuration
CSRF_TOKEN_EXPIRY=3600000  # 1 hour in milliseconds
CSRF_CRITICAL_EXPIRY=900000  # 15 minutes for critical operations

# Verification Configuration
OTP_EXPIRY=300000  # 5 minutes
VERIFICATION_EXPIRY=900000  # 15 minutes
MAX_VERIFICATION_ATTEMPTS=3

# Email Service (for OTP delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
```

---

## 7. Monitoring & Logging

All security events are logged with:
- User ID
- Event type (csrf_validation, verification_initiated, etc.)
- IP address
- User agent
- Timestamp
- Result status

Check logs via:
```
logs/error.log
logs/security.log
logs/audit.log
```

---

## 8. Migration Guide

### For Existing Routes

1. **Ensure CSRF token included** in all state-changing requests
2. **Add verification endpoints** to routes handling sensitive operations
3. **Update frontend** to send verification sessions for critical ops
4. **Test thoroughly** in development mode

### Breaking Changes

None - CSRF is backward compatible. Existing routes continue working but should adopt new patterns.

---

## Contact & Support

For security questions or to report vulnerabilities:
- Email: security@smarttoolshub.com
- Do not publicly disclose security vulnerabilities
- Allow 48 hours for initial response
