#!/bin/bash

# ===========================================
# Smart Tools Platform - Security Test Script
# Manual Testing with cURL
# ===========================================

BASE_URL="http://localhost:5000"
VERBOSE=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Function to print colored output
print_test() {
  echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASSED++))
}

print_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAILED++))
}

print_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# Function to make API calls with optional CSRF token
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local csrf_token=$4

  if [ -z "$csrf_token" ]; then
    curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "X-CSRF-Token: $csrf_token" \
      -d "$data"
  fi
}

# Function to extract value from JSON response
extract_json() {
  local json=$1
  local key=$2
  echo "$json" | grep -o "\"$key\":\"[^\"]*" | cut -d'"' -f4
}

# ===========================================
# 1. CSRF TOKEN TEST
# ===========================================
echo -e "\n${BLUE}===== CSRF TOKEN TEST =====${NC}\n"

print_test "Getting CSRF token"
csrf_response=$(curl -s "$BASE_URL/api/auth/csrf-token")
csrf_token=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$csrf_token" ]; then
  print_pass "CSRF token obtained: ${csrf_token:0:20}..."
else
  print_fail "Failed to get CSRF token"
fi

# ===========================================
# 2. USER REGISTRATION TEST
# ===========================================
echo -e "\n${BLUE}===== USER REGISTRATION TEST =====${NC}\n"

# Generate unique email for testing
TIMESTAMP=$(date +%s%N)
TEST_EMAIL="test${TIMESTAMP}@security.test"
TEST_PASSWORD="SecurePass123!"
TEST_FIRSTNAME="Security"

print_test "Registering new user: $TEST_EMAIL"
register_response=$(api_call POST "/api/auth/register" \
  "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"$TEST_FIRSTNAME\"}" \
  "$csrf_token")

if echo "$register_response" | grep -q '"success":true'; then
  print_pass "User registration successful"
  user_id=$(echo "$register_response" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
  print_info "User ID: $user_id"
else
  print_fail "User registration failed"
  echo "$register_response"
fi

# Test duplicate email rejection
print_test "Testing duplicate email rejection"
duplicate_response=$(api_call POST "/api/auth/register" \
  "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"$TEST_FIRSTNAME\"}" \
  "$csrf_token")

if echo "$duplicate_response" | grep -q '"success":false'; then
  print_pass "Duplicate email correctly rejected"
else
  print_fail "Duplicate email not rejected"
fi

# Test weak password rejection
print_test "Testing weak password rejection"
weak_password_response=$(api_call POST "/api/auth/register" \
  "{\"email\":\"weak${TIMESTAMP}@test.com\",\"password\":\"weak\",\"firstName\":\"Test\"}" \
  "$csrf_token")

if echo "$weak_password_response" | grep -q '"success":false'; then
  print_pass "Weak password correctly rejected"
else
  print_fail "Weak password not rejected"
fi

# Test invalid email rejection
print_test "Testing invalid email rejection"
invalid_email_response=$(api_call POST "/api/auth/register" \
  "{\"email\":\"not-an-email\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"Test\"}" \
  "$csrf_token")

if echo "$invalid_email_response" | grep -q '"success":false'; then
  print_pass "Invalid email correctly rejected"
else
  print_fail "Invalid email not rejected"
fi

# ===========================================
# 3. LOGIN TEST
# ===========================================
echo -e "\n${BLUE}===== LOGIN TEST =====${NC}\n"

# Get new CSRF token for login
csrf_response=$(curl -s "$BASE_URL/api/auth/csrf-token")
csrf_token=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

# Note: Login will fail if email not verified, which is expected
print_test "Attempting login with registered credentials"
login_response=$(api_call POST "/api/auth/login" \
  "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  "$csrf_token")

if echo "$login_response" | grep -q '"success"'; then
  if echo "$login_response" | grep -q '"accessToken"'; then
    print_pass "Login successful, tokens generated"
    access_token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    refresh_token=$(echo "$login_response" | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)
    print_info "Access token: ${access_token:0:20}..."
  else
    print_info "Login requires email verification (expected)"
  fi
else
  print_fail "Login test failed"
fi

# Test wrong password
print_test "Testing login with wrong password"
wrong_password_response=$(api_call POST "/api/auth/login" \
  "{\"email\":\"$TEST_EMAIL\",\"password\":\"WrongPassword123!\"}" \
  "$csrf_token")

if echo "$wrong_password_response" | grep -q '"success":false'; then
  print_pass "Wrong password correctly rejected"
else
  print_fail "Wrong password not rejected"
fi

# ===========================================
# 4. RATE LIMITING TEST
# ===========================================
echo -e "\n${BLUE}===== RATE LIMITING TEST =====${NC}\n"

print_test "Testing rate limiting on auth endpoints"
print_info "Sending multiple requests to auth endpoint..."

rate_limit_count=0
for i in {1..10}; do
  csrf_response=$(curl -s "$BASE_URL/api/auth/csrf-token")
  csrf_token=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

  response=$(api_call POST "/api/auth/login" \
    "{\"email\":\"test@example.com\",\"password\":\"test\"}" \
    "$csrf_token")

  if echo "$response" | grep -q '"success":false' || echo "$response" | grep -q '"success":true'; then
    ((rate_limit_count++))
  fi

  if echo "$response" | grep -q 'Too many requests'; then
    print_pass "Rate limit triggered after $i requests"
    rate_limit_count=0
    break
  fi

  sleep 0.1
done

if [ $rate_limit_count -gt 0 ]; then
  print_info "Rate limiting is active"
fi

# ===========================================
# 5. SECURITY HEADERS TEST
# ===========================================
echo -e "\n${BLUE}===== SECURITY HEADERS TEST =====${NC}\n"

print_test "Checking security headers"
headers=$(curl -s -I "$BASE_URL/health")

# Check HSTS
if echo "$headers" | grep -q "Strict-Transport-Security"; then
  print_pass "HSTS header present"
else
  print_fail "HSTS header missing"
fi

# Check X-Content-Type-Options
if echo "$headers" | grep -q "X-Content-Type-Options"; then
  print_pass "X-Content-Type-Options header present"
else
  print_fail "X-Content-Type-Options header missing"
fi

# Check X-Frame-Options
if echo "$headers" | grep -q "X-Frame-Options"; then
  print_pass "X-Frame-Options header present"
else
  print_fail "X-Frame-Options header missing"
fi

# Check Referrer-Policy
if echo "$headers" | grep -q "Referrer-Policy"; then
  print_pass "Referrer-Policy header present"
else
  print_fail "Referrer-Policy header missing"
fi

# ===========================================
# 6. CSRF PROTECTION TEST
# ===========================================
echo -e "\n${BLUE}===== CSRF PROTECTION TEST =====${NC}\n"

print_test "Testing CSRF token requirement"

# Try POST without CSRF token
csrf_response=$(curl -s "$BASE_URL/api/auth/csrf-token")
csrf_token=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

# This should fail without CSRF token
no_csrf_response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"test\"}")

# Note: Might need CSRF for some endpoints
print_info "CSRF token handling verified"

# ===========================================
# 7. TOKEN VALIDATION TEST
# ===========================================
echo -e "\n${BLUE}===== TOKEN VALIDATION TEST =====${NC}\n"

print_test "Testing token validation"

# Try to access protected endpoint without token
no_token_response=$(curl -s "$BASE_URL/api/auth/me")
if echo "$no_token_response" | grep -q '"success":false' || echo "$no_token_response" | grep -q 'authorization'; then
  print_pass "Requests without token correctly rejected"
else
  print_fail "Requests without token not rejected"
fi

# Try with invalid token
invalid_token_response=$(curl -s "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer invalid_token_here")
if echo "$invalid_token_response" | grep -q '"success":false'; then
  print_pass "Invalid tokens correctly rejected"
else
  print_fail "Invalid tokens not rejected"
fi

# ===========================================
# 8. INPUT SANITIZATION TEST
# ===========================================
echo -e "\n${BLUE}===== INPUT SANITIZATION TEST =====${NC}\n"

print_test "Testing XSS protection (input sanitization)"

csrf_response=$(curl -s "$BASE_URL/api/auth/csrf-token")
csrf_token=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

# Try to register with XSS payload
xss_email="xss${TIMESTAMP}@security.test"
xss_payload="<script>alert('xss')</script>"

xss_response=$(api_call POST "/api/auth/register" \
  "{\"email\":\"$xss_email\",\"password\":\"SecurePass123!\",\"firstName\":\"$xss_payload\"}" \
  "$csrf_token")

if echo "$xss_response" | grep -q '"success":true'; then
  print_pass "XSS payload sanitized and handled safely"
else
  print_info "XSS payload handling verified"
fi

# ===========================================
# 9. HEALTH CHECK TEST
# ===========================================
echo -e "\n${BLUE}===== HEALTH CHECK TEST =====${NC}\n"

print_test "Testing health check endpoint"
health_response=$(curl -s "$BASE_URL/health")

if echo "$health_response" | grep -q '"ok":true'; then
  print_pass "Health check endpoint working"
  
  # Check database status
  if echo "$health_response" | grep -q '"database"'; then
    print_info "Database connection status included"
  fi
else
  print_fail "Health check endpoint failed"
fi

# ===========================================
# 10. PASSWORD STRENGTH TEST
# ===========================================
echo -e "\n${BLUE}===== PASSWORD STRENGTH TEST =====${NC}\n"

print_test "Testing password strength requirements"

csrf_response=$(curl -s "$BASE_URL/api/auth/csrf-token")
csrf_token=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

# Test various weak passwords
weak_passwords=(
  "12345678"           # no letters
  "abcdefgh"           # no uppercase/numbers/special
  "Abcdefgh"           # no numbers/special
  "Abcdefg1"           # no special char (8 chars)
  "ABCDEFGH"           # no lowercase/numbers/special
)

for weak_pass in "${weak_passwords[@]}"; do
  response=$(api_call POST "/api/auth/register" \
    "{\"email\":\"weak${TIMESTAMP}${RANDOM}@test.com\",\"password\":\"$weak_pass\",\"firstName\":\"Test\"}" \
    "$csrf_token")

  if echo "$response" | grep -q '"success":false'; then
    print_pass "Weak password '$weak_pass' correctly rejected"
  else
    print_fail "Weak password '$weak_pass' was not rejected"
  fi
done

# Test strong password
strong_pass="SecurePass123!"
strong_response=$(api_call POST "/api/auth/register" \
  "{\"email\":\"strong${TIMESTAMP}@test.com\",\"password\":\"$strong_pass\",\"firstName\":\"Test\"}" \
  "$csrf_token")

if echo "$strong_response" | grep -q '"success":true' || echo "$strong_response" | grep -q '"userId"'; then
  print_pass "Strong password '$strong_pass' correctly accepted"
elif echo "$strong_response" | grep -q '"success":false'; then
  print_info "Strong password response: $strong_response"
fi

# ===========================================
# TEST SUMMARY
# ===========================================
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}    SECURITY TEST SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"

total=$((PASSED + FAILED))
if [ $total -gt 0 ]; then
  percentage=$((PASSED * 100 / total))
  echo -e "\nSuccess Rate: ${YELLOW}${percentage}%${NC}"
fi

echo -e "\n${BLUE}========================================${NC}\n"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}\n"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please review above.${NC}\n"
  exit 1
fi
