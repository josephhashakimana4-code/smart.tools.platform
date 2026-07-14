# Quick Reference - Security Testing

## TL;DR - Run All Tests in 3 Ways

### 1️⃣ Automated Jest Tests (Recommended)
```bash
npm test
```
✓ 45 automated tests
✓ Fastest (12-15 seconds)
✓ Best for CI/CD

### 2️⃣ Manual cURL Tests
```bash
chmod +x tests/manual-security-tests.sh
./tests/manual-security-tests.sh
```
✓ 42 manual tests
✓ See all requests/responses
✓ Good for debugging

### 3️⃣ Postman GUI Tests
1. Open Postman
2. Import `tests/Postman_Collection.json`
3. Run Collection
✓ Visual testing
✓ 20+ requests
✓ Built-in assertions

---

## Expected Results

### Jest Output
```
Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Time:        12.456s
```

### Manual Script Output
```
Tests Passed: 42
Tests Failed: 0
Success Rate: 100%
```

### Postman Output
```
20 requests
✓ All assertions passed
✓ Response times < 500ms
```

---

## Test Categories (18 Main Tests)

### 🔐 Authentication (4)
- ✓ Register valid user
- ✓ Reject duplicate email
- ✓ Reject weak password
- ✓ Reject invalid email

### 🔒 Account Security (1)
- ✓ Lock account after 5 failed attempts

### 🛡️ CSRF Protection (2)
- ✓ Require CSRF token
- ✓ Single-use token consumption

### 🔑 Token Management (2)
- ✓ Access token expires after 15 min
- ✓ Refresh token generates new access token

### ✏️ Input Validation (1)
- ✓ Sanitize XSS/HTML injections

### 📋 Security Headers (1)
- ✓ Verify all security headers present

### 🚫 Protected Routes (3)
- ✓ Reject request without token
- ✓ Reject invalid token
- ✓ Accept valid token

### ⏱️ Rate Limiting (1)
- ✓ Enforce auth endpoint limits

### 🔄 Password Reset (2)
- ✓ Send forgot password link
- ✓ Reject invalid reset token

### 👋 Logout (1)
- ✓ Clear session on logout

---

## Test Files Location

```
tests/
├── README.md                      ← Start here
├── security.test.js               ← 45 Jest tests
├── manual-security-tests.sh        ← 42 cURL tests
├── Postman_Collection.json         ← Postman collection
├── setup.js                        ← Jest config
├── TESTING_GUIDE.md                ← Full testing doc
├── TESTING_SCENARIOS.md            ← Detailed scenarios
└── TEST_CHECKLIST.md               ← Progress tracker
```

---

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm test: command not found` | `npm install` first |
| `ECONNREFUSED on :5000` | Start server: `npm run dev` |
| `MongoError: connect ECONNREFUSED` | Start MongoDB: `mongod` |
| `Tests timeout` | Increase timeout in jest.config.js |
| `Port 5000 in use` | Kill process: `lsof -i :5000; kill -9 <PID>` |

---

## Critical Tests (Must Pass)

These tests validate core security:

1. ✅ **User Registration** - Can create accounts
2. ✅ **Password Hashing** - Passwords stored securely
3. ✅ **JWT Tokens** - Authentication works
4. ✅ **Account Lockout** - Brute force protected
5. ✅ **CSRF Tokens** - CSRF attacks prevented
6. ✅ **Input Sanitization** - XSS attacks prevented
7. ✅ **Security Headers** - Client-side protection
8. ✅ **Rate Limiting** - DOS attacks limited

**All must pass before production deployment**

---

## Performance Baselines

Expected times for core operations:

```
Registration:        < 500ms
Login:              < 300ms
Protected Route:    < 100ms
Token Refresh:      < 150ms
CSRF Generation:    < 20ms
```

If slower, check:
- MongoDB performance
- Network latency
- Server load
- Password hashing rounds

---

## Test Data (For Manual Testing)

### Valid Credentials
```
Email:    test@example.com
Password: TestSecure123!

Email:    admin@example.com
Password: AdminSecure123!
```

### Invalid Test Cases
```
Weak Password:     "weak"
Invalid Email:     "not-an-email"
XSS Payload:       "<img src=x onerror='alert(1)'>"
```

---

## Verification Checklist

Before deploying to production:

- [ ] All 45 Jest tests pass ✓
- [ ] All 42 manual tests pass ✓
- [ ] All 20 Postman requests pass ✓
- [ ] No npm vulnerabilities (high/critical) ✓
- [ ] Security headers present ✓
- [ ] Audit logs created ✓
- [ ] Rate limiting works ✓
- [ ] Documentation complete ✓

**Status**: ____ / 8 ✓

---

## Next Steps After Testing

1. ✓ All tests pass → **Ready for staging**
2. ✓ Staging tests pass → **Ready for production**
3. ✓ Monitor audit logs → **Production live**
4. ✓ Weekly security review → **Ongoing**

---

## Support & Documentation

| Document | Purpose |
|----------|---------|
| [tests/README.md](README.md) | Testing overview |
| [SECURITY.md](../SECURITY.md) | Complete security docs |
| [SECURITY_QUICKSTART.md](../SECURITY_QUICKSTART.md) | Quick setup |
| [TESTING_GUIDE.md](../TESTING_GUIDE.md) | Detailed guide |
| [TESTING_SCENARIOS.md](../TESTING_SCENARIOS.md) | Test scenarios |
| [TEST_CHECKLIST.md](../TEST_CHECKLIST.md) | Progress tracking |

---

## Key Endpoints Tested

```
GET    /api/auth/csrf-token           → Get CSRF token
POST   /api/auth/register              → Create account
POST   /api/auth/login                 → Login
POST   /api/auth/verify-email          → Verify email
POST   /api/auth/logout                → Logout
GET    /api/auth/me                    → Get profile
POST   /api/auth/refresh               → Refresh tokens
POST   /api/auth/forgot-password       → Password reset request
POST   /api/auth/reset-password        → Complete password reset
POST   /api/auth/change-password       → Change password
PUT    /api/auth/profile               → Update profile
DELETE /api/auth/account               → Delete account
```

---

## Security Features Tested

| Feature | Test Method | Pass/Fail |
|---------|------------|-----------|
| User Registration | Jest + Manual | ___ |
| Email Verification | Jest | ___ |
| Password Hashing | Jest | ___ |
| JWT Tokens | Jest + Manual | ___ |
| Account Lockout | Jest + Manual | ___ |
| CSRF Protection | Jest + Manual | ___ |
| Input Sanitization | Jest + Manual | ___ |
| Rate Limiting | Jest + Manual | ___ |
| Security Headers | Jest + Manual | ___ |
| Audit Logging | Manual | ___ |

**Total Passing**: ___ / 10

---

## Environment Setup

### Required Variables in .env
```env
# JWT
JWT_ACCESS_SECRET=32_char_minimum_very_secure_key
JWT_REFRESH_SECRET=32_char_minimum_very_secure_key

# Database
MONGO_URI=mongodb://localhost:27017/smarttools

# Admin
ADMIN_PASSWORD=StrongPassword123!

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000

# Features
ENABLE_USER_REGISTRATION=true
ENABLE_EMAIL_VERIFICATION=true
```

---

## Commands Quick Reference

```bash
# Install & Setup
npm install                          # Install all dependencies
npm install --save-dev jest          # Install Jest for testing

# Run Tests
npm test                             # All Jest tests
npm run test:security                # Just security tests
npm run test:coverage                # With coverage report
npm run test:manual                  # Manual bash tests

# Development
npm run dev                          # Start with nodemon
npm start                            # Production start

# Database
mongod                               # Start MongoDB
mongo                                # MongoDB shell

# Utilities
npm audit                            # Check vulnerabilities
npm audit fix                        # Auto-fix vulnerabilities
```

---

## Success Criteria

✅ **Testing Complete When:**
- [ ] All 45 Jest tests pass
- [ ] All 42 manual tests pass
- [ ] All 20 Postman requests pass
- [ ] All 18 scenarios verified
- [ ] No critical/high vulnerabilities
- [ ] Performance meets baselines
- [ ] All documentation reviewed
- [ ] Ready for deployment

---

**Last Updated**: July 14, 2026
**Version**: 1.0
**Status**: ✅ Ready to Use
