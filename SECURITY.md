# Security Implementation Guide

## Overview

This document outlines all security features implemented in the Smart Tools Platform, including authentication, authorization, data protection, and audit logging.

## 1. Authentication System

### User Registration
- **Endpoint**: `POST /api/auth/register`
- **Requirements**:
  - Email must be valid and unique
  - Password must meet strength requirements (min 8 chars, uppercase, lowercase, number, special char)
  - First name required

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "userId": "user_id",
  "email": "user@example.com"
}
```

### User Login
- **Endpoint**: `POST /api/auth/login`
- **Features**:
  - Account lockout after 5 failed attempts (30 min lockout)
  - Email verification required
  - Rate limited: 5 requests per 15 minutes
  - Generates access + refresh tokens

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "user_id",
    "email": "user@example.com",
    "role": "user",
    "verified": true
  }
}
```

### Email Verification
- **Endpoint**: `POST /api/auth/verify-email`
- **Purpose**: Verify user email before full account access
- **Token**: Sent via email (24 hour expiry)

**Request**:
```json
{
  "verificationToken": "verification_token_from_email"
}
```

### Logout
- **Endpoint**: `POST /api/auth/logout`
- **Requires**: Valid access token
- **Action**: Removes current session from active sessions

### Password Reset
- **Step 1**: `POST /api/auth/forgot-password`
  - Sends reset token to email (1 hour expiry)
  - Doesn't reveal if email exists
  
**Request**:
```json
{
  "email": "user@example.com"
}
```

- **Step 2**: `POST /api/auth/reset-password`
  - Validates reset token
  - Updates password
  - Clears failed login attempts
  
**Request**:
```json
{
  "resetToken": "reset_token_from_email",
  "newPassword": "NewSecurePass123!"
}
```

### Change Password
- **Endpoint**: `POST /api/auth/change-password`
- **Requires**: Authenticated user + current password
- **Effect**: Invalidates all active sessions

**Request**:
```json
{
  "password": "CurrentPass123!",
  "newPassword": "NewSecurePass123!"
}
```

## 2. Token System

### JWT Configuration

**Access Token**:
- Expires: 15 minutes
- Used for API authentication
- Includes user role, plan, verification status
- Header: `Authorization: Bearer {token}`

**Refresh Token**:
- Expires: 7 days
- Used to obtain new access tokens
- Secure long-lived authentication

**Refresh Token Usage**:
```json
POST /api/auth/refresh
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response:
{
  "success": true,
  "accessToken": "new_access_token",
  "refreshToken": "new_refresh_token"
}
```

### Token Validation
- Tokens are cryptographically signed
- Issuer and audience validation
- Token version tracking (invalidates tokens on password change)

## 3. Rate Limiting

### Different Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 120 requests | 1 minute |
| Auth endpoints | 5 requests | 15 minutes |
| API endpoints | 30 requests | 1 minute |

## 4. Input Validation & Sanitization

### XSS Protection
- All user inputs are sanitized using XSS library
- HTML tags are stripped automatically
- Applied to request body and query parameters

### Email Validation
- RFC 5322 compliant email format
- Maximum 254 characters
- Lowercase normalization

### Password Requirements
```
Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (@$!%*?&)
```

### Request Size Limit
- Maximum 5MB per request
- Prevents buffer overflow attacks

## 5. CORS Configuration

### Allowed Origins (Environment Variable)
```env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Security Headers
- Only specified origins allowed
- Credentials only sent to whitelisted origins
- Methods restricted to GET, POST, PUT, DELETE, PATCH
- Headers restricted to essential types

## 6. Security Headers (Helmet.js)

### Enabled Headers

| Header | Purpose |
|--------|---------|
| Content-Security-Policy | Prevents XSS attacks |
| X-Content-Type-Options | Prevents MIME sniffing |
| X-Frame-Options | Prevents clickjacking |
| Strict-Transport-Security | Enforces HTTPS |
| X-XSS-Protection | Legacy XSS protection |
| Referrer-Policy | Controls referrer information |

### HSTS Configuration
- Max age: 1 year (31536000 seconds)
- Include subdomains
- Preload enabled

## 7. CSRF Protection

### CSRF Token System
- **Endpoint**: `GET /api/auth/csrf-token`
- Tokens valid for 1 hour
- One-time use (consumed after use)
- Required for state-changing requests (POST, PUT, DELETE, PATCH)

**Header**: `X-CSRF-Token: {token}`

**Skipped for**:
- GET, HEAD, OPTIONS requests
- Public endpoints (register, login, tools, blog)

## 8. Account Security

### Account Lockout
- Triggered after 5 failed login attempts
- Duration: 30 minutes
- Prevents brute force attacks
- Automatically unlocks after timeout

### Login Attempt Tracking
- Tracks failed and successful attempts
- Records IP address and user agent
- Logs all authentication events

### Session Management
- Maximum 5 active sessions per user
- Each session tracks creation time, IP, user agent
- Sessions expire with access token
- Can manually logout/revoke sessions

## 9. Audit Logging

### Log Events

**Authentication Events**:
- Registration (success/failure)
- Login (success/failure)
- Logout
- Email verification
- Password reset/change
- Account deletion

**Security Events**:
- Invalid tokens
- Unauthorized access attempts
- Failed password changes
- Account lockouts

**API Access**:
- Endpoint, method, status code
- Response time
- User ID and IP address

### Log Storage
- File-based logs in `/logs/` directory
- Separate audit and error logs
- Rotation at 5MB per file
- Maximum 5 files retained

**Log Files**:
- `logs/audit.log` - All audit events
- `logs/error-audit.log` - Security errors

## 10. Database Security

### User Model Protection
- Passwords hashed with bcrypt (12 salt rounds)
- Sensitive fields excluded from JSON responses
- Never expose: passwords, reset tokens, 2FA secrets
- Soft delete for account deletion

### Schema Validation
- Required fields enforced
- Email uniqueness index
- Type validation on all fields
- Default values for security flags

## 11. Environment Variables

### Required Security Variables
```env
# JWT Secrets (min 32 characters recommended)
JWT_ACCESS_SECRET=your_secure_access_key
JWT_REFRESH_SECRET=your_secure_refresh_key

# Admin
ADMIN_PASSWORD=your_strong_password

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## 12. API Usage Examples

### Frontend Integration

**1. Get CSRF Token**:
```javascript
const csrfResponse = await fetch('/api/auth/csrf-token');
const { csrfToken } = await csrfResponse.json();
```

**2. Register User**:
```javascript
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John'
  })
});
```

**3. Login**:
```javascript
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});

const { accessToken, refreshToken } = await loginResponse.json();
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

**4. Authenticated API Call**:
```javascript
const response = await fetch('/api/protected-endpoint', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken
  }
});
```

**5. Refresh Token**:
```javascript
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});

const { accessToken: newToken } = await refreshResponse.json();
localStorage.setItem('accessToken', newToken);
```

## 13. Deployment Checklist

- [ ] Set all environment variables securely
- [ ] Use HTTPS only (enforce in CORS)
- [ ] Update `ALLOWED_ORIGINS` to production domains
- [ ] Set strong JWT secrets (min 32 characters)
- [ ] Set strong `ADMIN_PASSWORD`
- [ ] Configure SMTP for email verification
- [ ] Enable `NODE_ENV=production`
- [ ] Review and adjust rate limits
- [ ] Set up log rotation/archival
- [ ] Monitor audit logs regularly
- [ ] Test password reset flow
- [ ] Test account lockout after failed attempts
- [ ] Verify CSRF token requirement

## 14. Security Best Practices

### For Administrators
- Change admin password immediately after deployment
- Rotate JWT secrets periodically
- Monitor audit logs for suspicious activity
- Implement backup and disaster recovery
- Use HTTPS only
- Keep Node.js and dependencies updated

### For Users
- Use strong, unique passwords
- Enable two-factor authentication (when available)
- Don't share access tokens
- Log out when finished
- Update password regularly
- Report suspicious activity

### For Developers
- Never log sensitive data (passwords, tokens)
- Always validate and sanitize user input
- Use CSRF tokens for state-changing requests
- Implement proper error handling
- Test security features regularly
- Keep dependencies updated

## 15. Common Issues & Troubleshooting

### "Invalid CSRF Token"
- Ensure token is sent in `X-CSRF-Token` header
- Token expires after 1 hour
- Token is consumed after first use

### "Account Locked"
- Account locks after 5 failed login attempts
- Wait 30 minutes or manually reset in database
- Use "Forgot Password" to reset

### "Email Not Verified"
- Complete email verification before login
- Check spam folder for verification email
- TODO: Implement resend verification email

### "Token Expired"
- Use refresh token to get new access token
- Refresh token valid for 7 days
- After expiry, user must login again

### "CORS Error"
- Add origin to `ALLOWED_ORIGINS` environment variable
- Ensure credentials flag is set in fetch options
- Verify request methods are allowed

## 16. Future Security Enhancements

- [ ] Two-factor authentication (TOTP/SMS)
- [ ] OAuth2/OpenID Connect integration
- [ ] IP whitelist/blacklist
- [ ] Geographic login restrictions
- [ ] Passwordless authentication (WebAuthn)
- [ ] API key authentication for programmatic access
- [ ] Device fingerprinting
- [ ] Real-time threat detection
- [ ] Security incident response automation
