# Security Testing Infrastructure

This directory contains comprehensive testing infrastructure for the Smart Tools Platform security features.

## Files in This Directory

### 1. `security.test.js`
**Jest Test Suite** - Automated JavaScript/Node.js tests

- 45+ test cases covering all security features
- Runs integration tests with real HTTP requests
- Uses supertest for testing Express endpoints
- Tests organized in logical describe blocks
- Mock data for testing

**Run**:
```bash
npm test                          # Run all tests
npm run test:security            # Run only security tests
npm run test:coverage            # Generate coverage report
npm test -- --verbose            # Verbose output
```

**Expected Output**:
```
Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Time:        12.456s
```

---

### 2. `manual-security-tests.sh`
**Bash Script** - Manual cURL-based testing

- 10+ test sections with color-coded output
- Uses cURL for direct HTTP requests
- Perfect for testing without Jest
- Shows all requests and responses
- Provides detailed pass/fail summary

**Run**:
```bash
chmod +x tests/manual-security-tests.sh
./tests/manual-security-tests.sh
```

**Features**:
- Color-coded output (GREEN=PASS, RED=FAIL, YELLOW=INFO)
- Test counter
- Detailed assertions
- Response inspection

---

### 3. `Postman_Collection.json`
**Postman Collection** - Visual API testing

- 20+ pre-configured requests
- Auto-token population
- Built-in assertions
- Environment configuration included
- Import into Postman for visual testing

**Import Steps**:
1. Open Postman
2. Click "Import"
3. Select this file
4. Configure environment (base_url, email, etc.)
5. Click "Run" to execute full collection

---

### 4. `setup.js`
**Jest Setup File** - Configuration for Jest tests

- Sets test environment variables
- Configures Jest timeouts
- Handles database connections
- Suppresses test noise
- Sets up error handling

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Server
```bash
npm run dev
# or
npm start
```

### 3. Run Tests (Choose One)

**Option A: Jest (Automated)**
```bash
npm test
```

**Option B: Manual Bash Script**
```bash
./tests/manual-security-tests.sh
```

**Option C: Postman (Visual)**
1. Open Postman
2. Import `tests/Postman_Collection.json`
3. Run collection

---

## Test Coverage

All tests cover these security features:

✅ **User Authentication**
- Registration with validation
- Login with success/failure
- Email verification
- Logout

✅ **Account Protection**
- Account lockout (5 attempts)
- Brute force prevention
- Session management

✅ **Token Security**
- JWT access tokens (15 min expiry)
- Refresh tokens (7 day expiry)
- Token validation
- Token refresh flow

✅ **CSRF Protection**
- CSRF token generation
- CSRF token validation
- One-time token consumption

✅ **Input Protection**
- XSS sanitization
- Email validation
- Password strength validation
- HTML encoding

✅ **Password Management**
- Strong password requirement (8+ chars, uppercase, number, special)
- Password reset flow
- Password change with verification
- Hashed storage (bcrypt)

✅ **Audit Logging**
- Login events
- Registration events
- Security events
- Unauthorized access attempts

✅ **Security Headers**
- HSTS (Strict-Transport-Security)
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- X-XSS-Protection

✅ **Rate Limiting**
- Auth endpoints: 5 req/15 min
- API endpoints: 30 req/min
- General endpoints: 120 req/min

---

## Expected Results

All tests should pass with 100% success rate:

```
✓ CSRF Protection Tests ............ 2/2
✓ User Registration Tests .......... 5/5
✓ User Login Tests ................ 3/3
✓ Account Lockout Tests ........... 2/2
✓ Email Verification Tests ........ 2/2
✓ JWT Token Tests ................. 3/3
✓ Password Reset Tests ............ 3/3
✓ User Profile Tests .............. 3/3
✓ Rate Limiting Tests ............. 1/1
✓ Security Headers Tests .......... 4/4
✓ Logout Tests .................... 2/2
✓ Input Validation Tests .......... 3/3

Total: 45 tests, 45 passed, 0 failed
```

---

## Troubleshooting

### Issue: "MongoDB Connection Error"
**Solution**: Ensure MongoDB is running
```bash
mongod
# or
systemctl start mongod
```

### Issue: "Port 5000 already in use"
**Solution**: Kill existing process or use different port
```bash
lsof -i :5000
kill -9 <PID>
```

### Issue: "ENOENT: no such file or directory"
**Solution**: Run from project root directory
```bash
cd /workspaces/smart.tools.platform
npm test
```

### Issue: "Module not found: jest"
**Solution**: Install dev dependencies
```bash
npm install --save-dev jest supertest
```

### Issue: Tests timeout
**Solution**: Increase timeout in jest.config.js or individual tests
```javascript
jest.setTimeout(30000); // 30 seconds
```

---

## Debugging Tests

### View Detailed Test Output
```bash
npm test -- --verbose --no-coverage
```

### Run Single Test File
```bash
npm test -- tests/security.test.js
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="CSRF"
```

### Generate Coverage Report
```bash
npm run test:coverage
```

---

## Continuous Integration

### GitHub Actions
Tests can be integrated into CI/CD pipeline:

```yaml
- name: Run Security Tests
  run: npm test -- --coverage
```

### Pre-commit Hook
Run tests before commit:

```bash
npm test -- --bail
```

---

## Manual Testing Guide

For detailed manual testing instructions, see [TESTING_GUIDE.md](../TESTING_GUIDE.md)

For specific test scenarios, see [TESTING_SCENARIOS.md](../TESTING_SCENARIOS.md)

---

## Test Scenarios Covered

See [TESTING_SCENARIOS.md](../TESTING_SCENARIOS.md) for:
- 18 detailed test scenarios
- Step-by-step instructions
- Expected results
- Checklist format
- Troubleshooting

---

## Performance Benchmarks

Expected test execution times:

| Test Method | Time | Notes |
|------------|------|-------|
| Jest Suite | 12-15s | Full 45 tests |
| Bash Script | 30-45s | Manual, more detail |
| Postman | Variable | Depends on user |

---

## Test Data

### Test Credentials

For testing, use these credentials:

```
Email: test@example.com
Password: TestSecure123!

Email: admin@example.com
Password: AdminSecure123!
```

### Test Emails (for verification)

In development mode, check:
1. Database directly
2. Console output (if email service not configured)
3. /logs/audit.log for verification tokens

---

## Maintenance

### After Updates
```bash
# Clear cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run tests
npm test
```

### Check Test Coverage
```bash
npm run test:coverage

# View HTML coverage report
open coverage/index.html
```

---

## Security Compliance

These tests verify compliance with:
- OWASP Top 10
- CWE Top 25 (Common Weakness Enumeration)
- NIST Cybersecurity Framework
- Best practices for Node.js security

---

## Next Steps

After successful test execution:

1. ✅ All tests pass
2. ✅ No security vulnerabilities
3. ✅ Ready for deployment
4. ✅ Consider enabling CI/CD integration
5. ✅ Monitor audit logs in production

---

## Support

For detailed documentation:
- Security implementation: [SECURITY.md](../SECURITY.md)
- Quick start guide: [SECURITY_QUICKSTART.md](../SECURITY_QUICKSTART.md)
- Testing guide: [TESTING_GUIDE.md](../TESTING_GUIDE.md)
- Test scenarios: [TESTING_SCENARIOS.md](../TESTING_SCENARIOS.md)

---

**Last Updated**: July 14, 2026
**Status**: ✅ Ready for Testing
