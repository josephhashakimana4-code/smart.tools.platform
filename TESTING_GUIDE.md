# Complete Security Testing Guide

## Overview

This document provides comprehensive testing procedures for all security features implemented in the Smart Tools Platform.

## Table of Contents

1. [Setup](#setup)
2. [Automated Testing](#automated-testing)
3. [Manual Testing (cURL)](#manual-testing-curl)
4. [Postman Testing](#postman-testing)
5. [Test Scenarios](#test-scenarios)
6. [Expected Results](#expected-results)
7. [Troubleshooting](#troubleshooting)

---

## Setup

### Prerequisites

- Node.js 20+
- npm packages installed (`npm install`)
- MongoDB running
- Environment variables configured (`.env` file)

### Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start

# Check if server is running
curl http://localhost:5000/health
```

### Expected Health Check Response

```json
{
  "ok": true,
  "status": "healthy",
  "service": "smart-tools-platform",
  "timestamp": "2026-07-14T10:00:00.000Z",
  "database": "connected"
}
```

---

## Automated Testing

### Option 1: Jest Test Suite

#### Installation

```bash
npm install --save-dev jest supertest
```

#### Run Tests

```bash
# Run all tests
npm test

# Run with verbose output
npm test -- --verbose

# Run specific test suite
npm test -- tests/security.test.js

# Run with coverage
npm test -- --coverage
```

#### Expected Output

```
PASS  tests/security.test.js
  Smart Tools Platform - Security Tests
    CSRF Protection
      ✓ Should get CSRF token (45ms)
      ✓ CSRF token should be sent in response header (12ms)
    User Registration
      ✓ Should successfully register a new user (234ms)
      ✓ Should reject duplicate email (89ms)
      ✓ Should reject weak password (34ms)
      ✓ Should reject invalid email (28ms)
      ✓ Should sanitize input (XSS protection) (156ms)
    [... more tests ...]

Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        12.456s
```

### Option 2: Manual Shell Script

#### Make Script Executable

```bash
chmod +x tests/manual-security-tests.sh
```

#### Run Manual Tests

```bash
# Run all security tests
./tests/manual-security-tests.sh

# With verbose output
./tests/manual-security-tests.sh -v
```

#### Expected Output

```
===== CSRF TOKEN TEST =====

[TEST] Getting CSRF token
[PASS] CSRF token obtained: a1b2c3d4e5f6g7h8...

===== USER REGISTRATION TEST =====

[TEST] Registering new user: test123456789@security.test
[PASS] User registration successful
[INFO] User ID: 507f1f77bcf86cd799439011

[... more tests ...]

========================================
    SECURITY TEST SUMMARY
========================================

Tests Passed: 42
Tests Failed: 0

Success Rate: 100%

========================================

✓ All tests passed!
```

---

## Manual Testing (cURL)

### 1. Get CSRF Token

```bash
curl -X GET http://localhost:5000/api/auth/csrf-token

# Expected Response
{
  "success": true,
  "csrfToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

Save CSRF token for subsequent requests:
```bash
CSRF_TOKEN="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

### 2. Register New User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Expected Response (201 Created)
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "userId": "507f1f77bcf86cd799439011",
  "email": "testuser@example.com"
}
```

### 3. Test Duplicate Email Rejection

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!",
    "firstName": "Duplicate"
  }'

# Expected Response (409 Conflict)
{
  "success": false,
  "message": "Email already registered"
}
```

### 4. Test Weak Password Rejection

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "weak@example.com",
    "password": "weak",
    "firstName": "Test"
  }'

# Expected Response (400 Bad Request)
{
  "success": false,
  "message": "Password must be at least 8 characters"
}
```

### 5. Test Invalid Email Rejection

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "not-an-email",
    "password": "SecurePass123!",
    "firstName": "Test"
  }'

# Expected Response (400 Bad Request)
{
  "success": false,
  "message": "Invalid email format"
}
```

### 6. Test Login with Wrong Password

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "testuser@example.com",
    "password": "WrongPassword123!"
  }'

# Expected Response (401 Unauthorized)
{
  "success": false,
  "message": "Invalid email or password"
}
```

### 7. Test Account Lockout (5 Failed Attempts)

```bash
# Run login with wrong password 5 times
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{
      "email": "testuser@example.com",
      "password": "WrongPassword123!"
    }'
  echo "Attempt $i"
done

# 5th attempt should return (429 Too Many Requests)
{
  "success": false,
  "message": "Account temporarily locked due to too many failed login attempts. Try again later."
}
```

### 8. Test Protected Endpoint Without Token

```bash
curl -X GET http://localhost:5000/api/auth/me

# Expected Response (401 Unauthorized)
{
  "success": false,
  "message": "Missing or invalid authorization header"
}
```

### 9. Test Protected Endpoint with Invalid Token

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer invalid_token_here"

# Expected Response (401 Unauthorized)
{
  "success": false,
  "message": "Invalid or expired token",
  "code": "TOKEN_EXPIRED"
}
```

### 10. Test Security Headers

```bash
curl -I http://localhost:5000/health

# Expected Headers
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### 11. Test Password Reset Request

```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "testuser@example.com"
  }'

# Expected Response (200 OK)
{
  "success": true,
  "message": "If email exists, password reset link has been sent",
  "resetToken": "token_here" // For testing only
}
```

### 12. Test Token Refresh

```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'

# Expected Response (200 OK)
{
  "success": true,
  "accessToken": "new_access_token_here",
  "refreshToken": "new_refresh_token_here"
}
```

### 13. Test XSS Protection (Input Sanitization)

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "xss@example.com",
    "password": "SecurePass123!",
    "firstName": "<img src=x onerror=\"alert(1)\">"
  }'

# Expected Response (201 Created)
# firstName should be sanitized without script/dangerous code
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "userId": "507f1f77bcf86cd799439011",
  "email": "xss@example.com"
}
```

---

## Postman Testing

### Import Collection

1. Open Postman
2. Click **Import** button
3. Select **File**
4. Choose `tests/Postman_Collection.json`
5. Click **Import**

### Configure Environment

Before running tests, set up environment variables:

1. Click **Environments** in left sidebar
2. Create new environment `"Smart Tools - Testing"`
3. Add variables:
   - `base_url`: `http://localhost:5000`
   - `csrfToken`: (will be auto-populated)
   - `accessToken`: (will be auto-populated)
   - `refreshToken`: (will be auto-populated)
   - `testEmail`: (will be auto-populated)

### Run Collection

1. Click on collection name
2. Click **Run** button
3. Select environment
4. Click **Run Smart Tools Platform - Security Test Suite**
5. View results in console

### Expected Results Summary

```
1. CSRF & Token Management
   ✓ Get CSRF Token (200)

2. User Registration
   ✓ Register New User (201)
   ✓ Register - Duplicate Email (409)
   ✓ Register - Weak Password (400)
   ✓ Register - Invalid Email (400)

3. User Login
   ✓ Login - Wrong Password (401)
   ✓ Login - Non-existent User (401)

4. Token Refresh
   ✓ Refresh Token - Invalid (401)

5. Password Reset
   ✓ Forgot Password - Valid Email (200)
   ✓ Forgot Password - Non-existent Email (200)
   ✓ Reset Password - Invalid Token (400)

6. Protected Endpoints
   ✓ Get Profile - No Token (401)
   ✓ Get Profile - Invalid Token (401)

7. Security Headers
   ✓ Check Security Headers (200, headers verified)

8. Input Validation
   ✓ Register with XSS Payload (201)

Total: 20 tests, 20 passed
```

---

## Test Scenarios

### Scenario 1: Complete User Journey

**Objective**: Test full registration and login flow

**Steps**:
1. Get CSRF token
2. Register new user
3. Get new CSRF token
4. Attempt login (should fail - email not verified)
5. Verify email (with token from DB/email)
6. Login with correct credentials
7. Verify access token works
8. Refresh access token
9. Get user profile
10. Logout

**Expected Outcomes**:
- Registration: 201
- Login attempt pre-verification: 403
- Login post-verification: 200 with tokens
- Profile access: 200 with user data
- Logout: 200

---

### Scenario 2: Brute Force Protection

**Objective**: Test account lockout mechanism

**Steps**:
1. Get CSRF token
2. Attempt login 5 times with wrong password
3. Attempt login 6th time with correct password
4. Wait 30 minutes or manually reset lockout

**Expected Outcomes**:
- Attempts 1-5: 401 (wrong password)
- Attempt 6: 429 (account locked)
- Cannot login even with correct password until lockout expires

---

### Scenario 3: Security Headers

**Objective**: Verify all security headers are present

**Steps**:
1. Make any request to the server
2. Check response headers

**Expected Headers**:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

### Scenario 4: CSRF Protection

**Objective**: Verify CSRF tokens are required for state-changing requests

**Steps**:
1. Attempt POST request without CSRF token (should have issues)
2. Get CSRF token
3. Attempt same POST with CSRF token
4. Use CSRF token in different request (should fail - one-time use)
5. Get new CSRF token for another request

**Expected Outcomes**:
- Request without token: 403 (Forbidden)
- Request with token: Success (200/201)
- Reused token: 403 (Forbidden)
- Fresh token: Success

---

### Scenario 5: Password Requirements

**Objective**: Test password strength validation

**Test Cases**:
- ✗ `password` - no uppercase/number/special
- ✗ `Password` - no number/special
- ✗ `Password1` - no special character
- ✗ `Passw0rd` - no special character
- ✗ `password123!` - no uppercase
- ✗ `PASSWORD123!` - no lowercase
- ✗ `Pass123!` - 8 chars but missing variety
- ✓ `SecurePass123!` - meets all requirements

**Expected Outcomes**:
- All weak passwords: 400 (Bad Request)
- Strong password: 201 (Created)

---

## Expected Results

### Success Responses

#### 200 OK
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

#### 201 Created
```json
{
  "success": true,
  "message": "Resource created",
  "userId": "507f1f77bcf86cd799439011"
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request parameter",
  "fields": ["email", "password"]
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "code": "TOKEN_EXPIRED"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "CSRF token missing",
  "code": "CSRF_REQUIRED"
}
```

#### 409 Conflict
```json
{
  "success": false,
  "message": "Email already registered"
}
```

#### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

---

## Troubleshooting

### Issue: "CSRF token missing"

**Cause**: Endpoint requires CSRF token but it wasn't provided

**Solution**:
```bash
# Get CSRF token first
CSRF_TOKEN=$(curl -s http://localhost:5000/api/auth/csrf-token | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

# Use in request
curl -X POST http://localhost:5000/api/auth/login \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  ...
```

### Issue: "Email not verified"

**Cause**: User email hasn't been verified yet

**Solution**:
```bash
# In database, manually verify or use verification email
# To find verification token:
db.users.findOne({email: "test@example.com"})
# Get verificationToken and send verification request
curl -X POST http://localhost:5000/api/auth/verify-email \
  -d "{\"verificationToken\": \"token_from_db\"}"
```

### Issue: "Account temporarily locked"

**Cause**: Account locked after 5 failed login attempts

**Solution**:
```bash
# Wait 30 minutes for automatic unlock, or:
# In database, reset lockout
db.users.updateOne(
  {email: "test@example.com"},
  {$set: {lockUntil: null, loginAttempts: 0}}
)
```

### Issue: "Token expired"

**Cause**: Access token has expired (15 minute expiry)

**Solution**:
```bash
# Use refresh token to get new access token
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"your_refresh_token\"}"
```

### Issue: "Invalid email format"

**Cause**: Email doesn't match RFC 5322 standard

**Solution**:
```
Valid formats:
✓ user@example.com
✓ user.name@example.com
✓ user+tag@example.co.uk

Invalid formats:
✗ user@
✗ @example.com
✗ user @example.com
✗ user@example
```

### Issue: "CORS Error"

**Cause**: Request origin not in `ALLOWED_ORIGINS`

**Solution**:
1. Update `.env` file:
   ```env
   ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
   ```
2. Restart server
3. Make sure request origin matches exactly

### Issue: "MongoDB Connection Error"

**Cause**: MongoDB not running or connection string invalid

**Solution**:
```bash
# Check MongoDB is running
mongo --version

# Verify connection string in .env
MONGO_URI=mongodb://localhost:27017/smarttools

# Start MongoDB (on Linux)
sudo systemctl start mongod

# Or run locally
mongod
```

---

## Test Coverage Checklist

- [ ] CSRF token generation and validation
- [ ] User registration with validation
- [ ] Email verification flow
- [ ] User login with success and failure
- [ ] Account lockout after failed attempts
- [ ] Password reset flow
- [ ] Token refresh mechanism
- [ ] Protected endpoint access control
- [ ] Invalid token rejection
- [ ] Security headers presence
- [ ] Input sanitization (XSS protection)
- [ ] Email format validation
- [ ] Password strength validation
- [ ] Rate limiting
- [ ] User profile management
- [ ] Logout functionality
- [ ] Session management
- [ ] Audit logging

---

## Performance Benchmarks

Expected performance metrics:

| Operation | Time | Notes |
|-----------|------|-------|
| CSRF token generation | <10ms | Fast token creation |
| Registration | 200-300ms | Includes password hashing |
| Login attempt | 150-250ms | Includes password comparison |
| Protected endpoint | <50ms | JWT validation only |
| Account lockout check | <10ms | Quick database query |
| Token refresh | <100ms | Fast token generation |

---

## Continuous Testing

### GitHub Actions Workflow

Add to `.github/workflows/security-tests.yml`:

```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  security-test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:latest
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v2
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '20'
    - name: Install dependencies
      run: npm install
    - name: Run security tests
      run: npm test
```

---

## Support

For issues or questions about testing:

1. Review `SECURITY.md` for detailed feature documentation
2. Check audit logs in `logs/` directory
3. Review error responses in test output
4. Check MongoDB for user records and events

---

**Last Updated**: July 14, 2026
**Status**: ✅ Complete and Ready for Testing
