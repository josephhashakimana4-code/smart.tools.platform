# Testing Scenarios & Checklist

## Quick Test Summary

This document provides specific test scenarios to verify all security features work correctly.

## Prerequisites

1. **Server Running**: `npm run dev` or `npm start`
2. **MongoDB Connected**: Check with health endpoint
3. **Tools Available**: cURL or Postman
4. **Test Account**: Use unique emails for each test

---

## Test Category 1: User Authentication

### Test 1.1: Successful Registration

**Description**: A user should be able to register with valid credentials

**Steps**:
```bash
CSRF_TOKEN=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')

curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "validuser@test.com",
    "password": "ValidPass123!",
    "firstName": "Valid",
    "lastName": "User"
  }'
```

**Expected Result**:
```
Status: 201 Created
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "userId": "...",
  "email": "validuser@test.com"
}
```

**✓ Pass** / ✗ Fail: ___

---

### Test 1.2: Reject Duplicate Email

**Description**: Should not allow registration with existing email

**Steps**:
```bash
# Use same email as Test 1.1
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "validuser@test.com",
    "password": "ValidPass123!",
    "firstName": "Duplicate"
  }'
```

**Expected Result**:
```
Status: 409 Conflict
{
  "success": false,
  "message": "Email already registered"
}
```

**✓ Pass** / ✗ Fail: ___

---

### Test 1.3: Reject Weak Password

**Description**: Password must meet strength requirements

**Test Cases**:

| Password | Should Pass | Reason |
|----------|------------|--------|
| `password` | ✗ | No uppercase/number/special |
| `Password` | ✗ | No number/special |
| `Password1` | ✗ | No special character |
| `Pass@1` | ✗ | Too short (< 8 chars) |
| `SecurePass123!` | ✓ | Meets all requirements |

**Steps**:
```bash
# Test weak password
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "weak@test.com",
    "password": "weak",
    "firstName": "Test"
  }'
```

**Expected Result**:
```
Status: 400 Bad Request
{
  "success": false,
  "message": "Password must be at least 8 characters"
}
```

**✓ Pass** / ✗ Fail: ___

---

### Test 1.4: Reject Invalid Email

**Description**: Should validate email format strictly

**Test Cases**:

| Email | Should Pass | Reason |
|-------|------------|--------|
| `user@example.com` | ✓ | Valid |
| `user+tag@example.co.uk` | ✓ | Valid with subdomain |
| `notanemail` | ✗ | Missing @ and domain |
| `@example.com` | ✗ | Missing local part |
| `user@` | ✗ | Missing domain |
| `user @example.com` | ✗ | Contains space |

**Steps**:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "invalid-email",
    "password": "ValidPass123!",
    "firstName": "Test"
  }'
```

**Expected Result**:
```
Status: 400 Bad Request
{
  "success": false,
  "message": "Invalid email format"
}
```

**✓ Pass** / ✗ Fail: ___

---

## Test Category 2: Account Lockout

### Test 2.1: Account Locks After 5 Failed Attempts

**Description**: Account should lock after 5 failed login attempts

**Steps**:
```bash
# Create test account first
EMAIL="locktest@test.com"
PASS="LockTest123!"

# Register
CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')
curl -X POST http://localhost:5000/api/auth/register \
  -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"firstName\":\"Lock\"}"

# Attempt 5 failed logins
for i in {1..5}; do
  CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')
  curl -X POST http://localhost:5000/api/auth/login \
    -H "X-CSRF-Token: $CSRF" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword123!\"}"
  echo "Attempt $i"
done

# Try with correct password (should still be locked)
CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')
curl -X POST http://localhost:5000/api/auth/login \
  -H "X-CSRF-Token: $CSRF" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
```

**Expected Results**:
- Attempts 1-4: `Status: 401, "Invalid email or password"`
- Attempt 5: `Status: 401, "Invalid email or password"`
- After lock (with correct password): `Status: 429, "Account temporarily locked"`

**✓ Pass** / ✗ Fail: ___

---

## Test Category 3: CSRF Protection

### Test 3.1: CSRF Token Required

**Description**: State-changing requests should require CSRF token

**Steps**:
```bash
# Try POST without CSRF token (might depend on endpoint)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

**Expected Result**:
```
Status: 403 Forbidden (if endpoint enforces CSRF)
or
Status: 401 with message about missing/invalid token
```

**✓ Pass** / ✗ Fail: ___

---

### Test 3.2: CSRF Token One-Time Use

**Description**: CSRF tokens should be single-use

**Steps**:
```bash
# Get CSRF token
CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')

# Use it once (should work)
curl -X POST http://localhost:5000/api/auth/register \
  -H "X-CSRF-Token: $CSRF" \
  -d '{...}'

# Try to reuse same token (should fail)
curl -X POST http://localhost:5000/api/auth/register \
  -H "X-CSRF-Token: $CSRF" \
  -d '{...}'
```

**Expected Result**:
- First use: Success (201)
- Reuse attempt: Failure (403 - CSRF token invalid)

**✓ Pass** / ✗ Fail: ___

---

## Test Category 4: Token Management

### Test 4.1: Access Token Expiry

**Description**: Access tokens should expire after 15 minutes

**Steps**:
1. Login and get access token
2. Use token immediately (should work)
3. Wait 15+ minutes
4. Use expired token

```bash
# Get access token
TOKEN=$(curl -s http://localhost:5000/api/auth/login \
  -d '...' | jq -r '.accessToken')

# Use immediately
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
  
# Wait 15+ minutes then retry
sleep 901  # 15 min 1 sec
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Result**:
- Immediate use: `Status: 200, user data`
- After expiry: `Status: 401, "Invalid or expired token"`

**✓ Pass** / ✗ Fail: ___

---

### Test 4.2: Token Refresh

**Description**: Refresh token should generate new access token

**Steps**:
```bash
# Login and get tokens
RESPONSE=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"test@test.com","password":"TestPass123!"}')

REFRESH_TOKEN=$(echo $RESPONSE | jq -r '.refreshToken')

# Refresh
curl -X POST http://localhost:5000/api/auth/refresh \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

**Expected Result**:
```
Status: 200 OK
{
  "success": true,
  "accessToken": "new_token",
  "refreshToken": "new_refresh_token"
}
```

**✓ Pass** / ✗ Fail: ___

---

## Test Category 5: Input Validation

### Test 5.1: XSS Protection (Input Sanitization)

**Description**: HTML/JavaScript in input should be sanitized

**Steps**:
```bash
CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')

curl -X POST http://localhost:5000/api/auth/register \
  -H "X-CSRF-Token: $CSRF" \
  -d '{
    "email": "xss@test.com",
    "password": "SafePass123!",
    "firstName": "<img src=x onerror=\"alert(1)\">"
  }'
```

**Expected Result**:
- Registration should succeed (201)
- firstName should be sanitized (no dangerous HTML/JS)
- When retrieved, should not contain script tags

**✓ Pass** / ✗ Fail: ___

---

## Test Category 6: Security Headers

### Test 6.1: All Security Headers Present

**Description**: Response should include security headers

**Steps**:
```bash
curl -I http://localhost:5000/health
```

**Expected Headers**:
- `Strict-Transport-Security`: ✓ Present
- `X-Content-Type-Options: nosniff`: ✓ Present
- `X-Frame-Options: DENY`: ✓ Present
- `X-XSS-Protection`: ✓ Present
- `Referrer-Policy`: ✓ Present

**✓ Pass** / ✗ Fail: ___

---

## Test Category 7: Protected Endpoints

### Test 7.1: Reject Request Without Token

**Description**: Protected endpoints require authorization header

**Steps**:
```bash
curl http://localhost:5000/api/auth/me
```

**Expected Result**:
```
Status: 401 Unauthorized
{
  "success": false,
  "message": "Missing or invalid authorization header"
}
```

**✓ Pass** / ✗ Fail: ___

---

### Test 7.2: Reject Invalid Token

**Description**: Invalid tokens should be rejected

**Steps**:
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer invalid_token_here"
```

**Expected Result**:
```
Status: 401 Unauthorized
{
  "success": false,
  "message": "Invalid or expired token",
  "code": "TOKEN_EXPIRED"
}
```

**✓ Pass** / ✗ Fail: ___

---

### Test 7.3: Accept Valid Token

**Description**: Valid tokens should grant access

**Steps**:
```bash
# Login and get token
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -d '...' | jq -r '.accessToken')

# Use token
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Result**:
```
Status: 200 OK
{
  "success": true,
  "user": {
    "_id": "...",
    "email": "...",
    "firstName": "...",
    "role": "user",
    "verified": true
  }
}
```

**Note**: Sensitive fields (password, tokens) should NOT be present

**✓ Pass** / ✗ Fail: ___

---

## Test Category 8: Rate Limiting

### Test 8.1: Auth Endpoint Rate Limit

**Description**: Auth endpoints should rate limit (5 requests per 15 minutes)

**Steps**:
```bash
# Make 6 rapid requests to auth endpoint
for i in {1..6}; do
  CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')
  curl -X POST http://localhost:5000/api/auth/login \
    -H "X-CSRF-Token: $CSRF" \
    -d '{"email":"test@test.com","password":"test"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 0.2
done
```

**Expected Result**:
- Requests 1-5: Standard responses (200/401)
- Request 6: `Status: 429, "Too many requests"`

**✓ Pass** / ✗ Fail: ___

---

## Test Category 9: Password Reset

### Test 9.1: Forgot Password Request

**Description**: User should be able to request password reset

**Steps**:
```bash
CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')

curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"test@test.com"}'
```

**Expected Result**:
```
Status: 200 OK
{
  "success": true,
  "message": "If email exists, password reset link has been sent"
}
```

**Note**: Same message whether email exists or not (security)

**✓ Pass** / ✗ Fail: ___

---

### Test 9.2: Reset Password with Invalid Token

**Description**: Should reject invalid reset token

**Steps**:
```bash
CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')

curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "X-CSRF-Token: $CSRF" \
  -d '{
    "resetToken": "invalid_token",
    "newPassword": "NewPass123!"
  }'
```

**Expected Result**:
```
Status: 400 Bad Request
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

**✓ Pass** / ✗ Fail: ___

---

## Test Category 10: Logout

### Test 10.1: Successful Logout

**Description**: Authenticated user should be able to logout

**Steps**:
```bash
# Login first
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -d '...' | jq -r '.accessToken')

# Logout
CSRF=$(curl -s http://localhost:5000/api/auth/csrf-token | jq -r '.csrfToken')
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF"
```

**Expected Result**:
```
Status: 200 OK
{
  "success": true,
  "message": "Logout successful"
}
```

**✓ Pass** / ✗ Fail: ___

---

## Test Category 11: Audit Logging

### Test 11.1: Verify Audit Logs Are Created

**Description**: Security events should be logged

**Steps**:
```bash
# Run some test operations (registration, login, etc.)

# Check audit logs
tail -20 logs/audit.log

# Search for specific events
grep "login_success" logs/audit.log
grep "registration_success" logs/audit.log
```

**Expected Result**:
- Log file exists: `logs/audit.log`
- Contains JSON event entries
- Includes timestamps, user info, IP address
- Event types: registration, login, logout, password_reset, etc.

**✓ Pass** / ✗ Fail: ___

---

## Summary Checklist

**Category 1: User Authentication**
- [ ] Test 1.1: Successful Registration
- [ ] Test 1.2: Reject Duplicate Email
- [ ] Test 1.3: Reject Weak Password
- [ ] Test 1.4: Reject Invalid Email

**Category 2: Account Lockout**
- [ ] Test 2.1: Account Locks After 5 Failed Attempts

**Category 3: CSRF Protection**
- [ ] Test 3.1: CSRF Token Required
- [ ] Test 3.2: CSRF Token One-Time Use

**Category 4: Token Management**
- [ ] Test 4.1: Access Token Expiry
- [ ] Test 4.2: Token Refresh

**Category 5: Input Validation**
- [ ] Test 5.1: XSS Protection

**Category 6: Security Headers**
- [ ] Test 6.1: All Security Headers Present

**Category 7: Protected Endpoints**
- [ ] Test 7.1: Reject Request Without Token
- [ ] Test 7.2: Reject Invalid Token
- [ ] Test 7.3: Accept Valid Token

**Category 8: Rate Limiting**
- [ ] Test 8.1: Auth Endpoint Rate Limit

**Category 9: Password Reset**
- [ ] Test 9.1: Forgot Password Request
- [ ] Test 9.2: Reset Password with Invalid Token

**Category 10: Logout**
- [ ] Test 10.1: Successful Logout

**Category 11: Audit Logging**
- [ ] Test 11.1: Verify Audit Logs Are Created

---

**Total Tests**: 18
**Passed**: ___
**Failed**: ___

**Overall Status**: 
- [ ] All tests passed ✓
- [ ] Some tests failed - Review above

---

**Date Tested**: ___________
**Tested By**: ___________
**Notes**: ___________________________________________________
