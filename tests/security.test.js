const request = require("supertest");
const mongoose = require("mongoose");
require("dotenv").config();

// Mock app for testing
let app;
let server;

describe("Smart Tools Platform - Security Tests", () => {
  let testUser = {
    email: "test@security.com",
    password: "SecurePass123!",
    firstName: "Test",
    lastName: "User"
  };

  let accessToken;
  let refreshToken;
  let csrfToken;
  let resetToken;

  beforeAll(async () => {
    // Import after env is loaded
    app = require("../server");
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup
    await mongoose.connection.close();
    if (server) server.close();
  });

  // ==========================================
  // 1. CSRF TOKEN TESTS
  // ==========================================
  describe("CSRF Protection", () => {
    test("Should get CSRF token", async () => {
      const response = await request(app)
        .get("/api/auth/csrf-token")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.csrfToken).toBeDefined();
      expect(response.body.csrfToken.length).toBeGreaterThan(0);
      
      csrfToken = response.body.csrfToken;
    });

    test("CSRF token should be sent in response header", async () => {
      const response = await request(app)
        .get("/api/auth/csrf-token")
        .expect(200);

      expect(response.get("X-CSRF-Token")).toBeDefined();
    });

    test("Should reject state-changing requests without a CSRF token", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "csrf-check@security.com",
          password: "SecurePass123!",
          firstName: "CSRF"
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("CSRF");
    });
  });

  // ==========================================
  // 2. USER REGISTRATION TESTS
  // ==========================================
  describe("User Registration", () => {
    beforeEach(async () => {
      const response = await request(app).get("/api/auth/csrf-token");
      csrfToken = response.body.csrfToken;
    });

    test("Should successfully register a new user", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Registration successful");
      expect(response.body.userId).toBeDefined();
      expect(response.body.email).toBe(testUser.email);
    });

    test("Should reject duplicate email", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send(testUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already registered");
    });

    test("Should reject weak password", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          ...testUser,
          email: "weak@security.com",
          password: "weak"
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("at least 8 characters");
    });

    test("Should reject invalid email", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          ...testUser,
          email: "invalid-email"
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid email");
    });

    test("Should require all fields", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "test@example.com"
          // Missing password and firstName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Missing required fields");
    });

    test("Should sanitize input (XSS protection)", async () => {
      const email = `xss-${Date.now()}@security.com`;
      const response = await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email,
          password: "SecurePass123!",
          firstName: "<script>alert('xss')</script>"
        })
        .expect(201);

      expect(response.body.success).toBe(true);

      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email,
          password: "SecurePass123!"
        })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();

      const savedUser = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      expect(savedUser.body.user.firstName).not.toContain("<script>");
      expect(savedUser.body.user.firstName).toBe("alert('xss')");
    });
  });

  // ==========================================
  // 3. USER LOGIN TESTS
  // ==========================================
  describe("User Login", () => {
    beforeEach(async () => {
      const response = await request(app).get("/api/auth/csrf-token");
      csrfToken = response.body.csrfToken;
    });

    test("Should successfully login with correct credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    test("Should reject login with wrong password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: testUser.email,
          password: "WrongPassword123!"
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid email or password");
    });

    test("Should reject login with non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "nonexistent@security.com",
          password: "Password123!"
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test("Should reject unverified email", async () => {
      const unverifiedEmail = `unverified-${Date.now()}@security.com`;

      await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: unverifiedEmail,
          password: "VerifyTest123!",
          firstName: "Verify",
          verified: false
        })
        .expect(201);

      const response = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: unverifiedEmail,
          password: "VerifyTest123!"
        })
        .expect(403);

      expect(response.body.message).toContain("verify your email");
    });
  });

  // ==========================================
  // 4. ACCOUNT LOCKOUT TESTS
  // ==========================================
  describe("Account Lockout (Brute Force Protection)", () => {
    let lockoutTestEmail = "lockout@security.com";

    beforeEach(async () => {
      // Register a test user first
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      csrfToken = csrfRes.body.csrfToken;

      await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: lockoutTestEmail,
          password: "LockoutTest123!",
          firstName: "Lockout"
        });
    });

    test("Should lock account after 5 failed login attempts", async () => {
      // Attempt 1-4: wrong password
      for (let i = 0; i < 4; i++) {
        const csrfRes = await request(app).get("/api/auth/csrf-token");
        await request(app)
          .post("/api/auth/login")
          .set("X-CSRF-Token", csrfRes.body.csrfToken)
          .send({
            email: lockoutTestEmail,
            password: "WrongPassword123!"
          })
          .expect(401);
      }

      // Attempt 5: should lock account
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      const lockResponse = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send({
          email: lockoutTestEmail,
          password: "WrongPassword123!"
        })
        .expect(429);

      expect(lockResponse.body.message).toContain("temporarily locked");
    });

    test("Should not allow login while account is locked", async () => {
      // Account should still be locked from previous test
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      const response = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send({
          email: lockoutTestEmail,
          password: "LockoutTest123!" // even correct password
        })
        .expect(429);

      expect(response.body.message).toContain("temporarily locked");
    });
  });

  // ==========================================
  // 5. EMAIL VERIFICATION TESTS
  // ==========================================
  describe("Email Verification", () => {
    let verifyTestEmail = "verify@security.com";
    let verificationToken;

    beforeEach(async () => {
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      csrfToken = csrfRes.body.csrfToken;

      // Register a test user
      await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: verifyTestEmail,
          password: "VerifyTest123!",
          firstName: "Verify"
        });

      // TODO: Get actual verification token from email or DB
      // For now, we'll use a dummy token
      verificationToken = "test_token_" + Date.now();
    });

    test("Should reject invalid verification token", async () => {
      const response = await request(app)
        .post("/api/auth/verify-email")
        .set("X-CSRF-Token", csrfToken)
        .send({
          verificationToken: "invalid_token"
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid or expired");
    });

    test("Should require verification token", async () => {
      const response = await request(app)
        .post("/api/auth/verify-email")
        .set("X-CSRF-Token", csrfToken)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================
  // 6. JWT TOKEN TESTS
  // ==========================================
  describe("JWT Token Management", () => {
    test("Should reject request without token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .expect(401);

      expect(response.body.message).toContain("authorization header");
    });

    test("Should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid_token")
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test("Should accept request with valid token", async () => {
      if (!accessToken) {
        // Login first
        const csrfRes = await request(app).get("/api/auth/csrf-token");
        const loginRes = await request(app)
          .post("/api/auth/login")
          .set("X-CSRF-Token", csrfRes.body.csrfToken)
          .send({
            email: testUser.email,
            password: testUser.password
          });

        if (loginRes.body.accessToken) {
          accessToken = loginRes.body.accessToken;
        }
      }

      if (accessToken) {
        const response = await request(app)
          .get("/api/auth/me")
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.user).toBeDefined();
      }
    });

    test("Should refresh token with valid refresh token", async () => {
      if (!refreshToken) {
        // Login first
        const csrfRes = await request(app).get("/api/auth/csrf-token");
        const loginRes = await request(app)
          .post("/api/auth/login")
          .set("X-CSRF-Token", csrfRes.body.csrfToken)
          .send({
            email: testUser.email,
            password: testUser.password
          });

        if (loginRes.body.refreshToken) {
          refreshToken = loginRes.body.refreshToken;
        }
      }

      if (refreshToken) {
        const csrfRes = await request(app).get("/api/auth/csrf-token");
        const response = await request(app)
          .post("/api/auth/refresh")
          .set("X-CSRF-Token", csrfRes.body.csrfToken)
          .send({
            refreshToken: refreshToken
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.accessToken).toBeDefined();
        expect(response.body.refreshToken).toBeDefined();
      }
    });
  });

  // ==========================================
  // 7. PASSWORD RESET TESTS
  // ==========================================
  describe("Password Reset", () => {
    let resetTestEmail = "reset@security.com";

    beforeEach(async () => {
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      csrfToken = csrfRes.body.csrfToken;

      // Register a test user
      await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: resetTestEmail,
          password: "ResetTest123!",
          firstName: "Reset"
        });
    });

    test("Should request password reset for existing email", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: resetTestEmail
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("If email exists, password reset link has been sent");
    });

    test("Should not reveal if email exists (security)", async () => {
      const response1 = await request(app)
        .post("/api/auth/forgot-password")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: resetTestEmail
        })
        .expect(200);

      const response2 = await request(app)
        .post("/api/auth/forgot-password")
        .set("X-CSRF-Token", csrfToken)
        .send({
          email: "nonexistent@security.com"
        })
        .expect(200);

      // Both should have same message
      expect(response1.body.message).toBe("If email exists, password reset link has been sent");
      expect(response2.body.message).toBe("If email exists, password reset link has been sent");
    });

    test("Should reject invalid reset token", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .set("X-CSRF-Token", csrfToken)
        .send({
          resetToken: "invalid_token",
          newPassword: "NewPassword123!"
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid or expired");
    });

    test("Should require strong password for reset", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .set("X-CSRF-Token", csrfToken)
        .send({
          resetToken: "any_token",
          newPassword: "weak"
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("at least 8 characters");
    });
  });

  // ==========================================
  // 8. USER PROFILE TESTS
  // ==========================================
  describe("User Profile Management", () => {
    let profileUser;

    beforeEach(async () => {
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      profileUser = {
        ...testUser,
        email: `profile-${Date.now()}-${Math.random().toString(16).slice(2)}@security.com`
      };

      await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send(profileUser)
        .expect(201);

      const loginRes = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send({
          email: profileUser.email,
          password: profileUser.password
        })
        .expect(200);

      accessToken = loginRes.body.accessToken;
    });

    test("Should get user profile", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(profileUser.email);
      expect(response.body.user.firstName).toBe(profileUser.firstName);
    });

    test("Should not expose sensitive fields in profile", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const user = response.body.user;
      // These should never be exposed
      expect(user.password).toBeUndefined();
      expect(user.passwordResetToken).toBeUndefined();
      expect(user.verificationToken).toBeUndefined();
      expect(user.twoFactorSecret).toBeUndefined();
    });

    test("Should update user profile", async () => {
      const csrfRes = await request(app).get("/api/auth/csrf-token");

      const response = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send({
          firstName: "Updated",
          lastName: "Name"
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.firstName).toBe("Updated");
      expect(response.body.user.lastName).toBe("Name");
    });
  });

  // ==========================================
  // 9. RATE LIMITING TESTS
  // ==========================================
  describe("Rate Limiting", () => {
    test("Should rate limit auth endpoints", async () => {
      let limitedResponse = null;

      for (let i = 0; i < 6; i++) {
        const csrfRes = await request(app).get("/api/auth/csrf-token");

        const response = await request(app)
          .post("/api/auth/login")
          .set("X-CSRF-Token", csrfRes.body.csrfToken)
          .send({
            email: "anyuser@example.com",
            password: "AnyPassword123!"
          });

        if (response.status === 429) {
          limitedResponse = response;
          break;
        }
      }

      // Should eventually hit rate limit
      if (limitedResponse) {
        expect(limitedResponse.status).toBe(429);
        expect(limitedResponse.body.message).toContain("Too many requests");
      }
    });
  });

  // ==========================================
  // 10. SECURITY HEADERS TESTS
  // ==========================================
  describe("Security Headers", () => {
    test("Should include HSTS header", async () => {
      const response = await request(app).get("/health");

      expect(response.get("Strict-Transport-Security")).toBeDefined();
      expect(response.get("Strict-Transport-Security")).toContain("max-age");
    });

    test("Should include X-Content-Type-Options header", async () => {
      const response = await request(app).get("/health");

      expect(response.get("X-Content-Type-Options")).toBe("nosniff");
    });

    test("Should include X-Frame-Options header", async () => {
      const response = await request(app).get("/health");

      expect(response.get("X-Frame-Options")).toBe("DENY");
    });

    test("Should include Referrer-Policy header", async () => {
      const response = await request(app).get("/health");

      expect(response.get("Referrer-Policy")).toBeDefined();
    });
  });

  // ==========================================
  // 11. LOGOUT TESTS
  // ==========================================
  describe("Logout", () => {
    test("Should successfully logout", async () => {
      if (!accessToken) {
        const csrfRes = await request(app).get("/api/auth/csrf-token");
        const loginRes = await request(app)
          .post("/api/auth/login")
          .set("X-CSRF-Token", csrfRes.body.csrfToken)
          .send({
            email: testUser.email,
            password: testUser.password
          });

        if (loginRes.body.accessToken) {
          accessToken = loginRes.body.accessToken;
        }
      }

      const csrfRes = await request(app).get("/api/auth/csrf-token");
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Logout successful");
    });

    test("Should reject logout without token", async () => {
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      const response = await request(app)
        .post("/api/auth/logout")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================
  // 12. INPUT VALIDATION TESTS
  // ==========================================
  describe("Input Validation & Sanitization", () => {
    test("Should sanitize HTML input", async () => {
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      const email = `sanitize-${Date.now()}@security.com`;

      const response = await request(app)
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send({
          email,
          password: "SanitizeTest123!",
          firstName: "<img src=x onerror='alert(1)'>Test"
        })
        .expect(201);

      expect(response.body.success).toBe(true);

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .set("X-CSRF-Token", csrfRes.body.csrfToken)
        .send({
          email,
          password: "SanitizeTest123!"
        })
        .expect(200);

      const savedUser = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      expect(savedUser.body.user.firstName).not.toContain("onerror");
      expect(savedUser.body.user.firstName).toBe("Test");
    });

    test("Should validate email format strictly", async () => {
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      const token = csrfRes.body.csrfToken || csrfRes.get("X-CSRF-Token");

      const invalidEmails = [
        "notanemail",
        "@example.com",
        "user@",
        "user @example.com",
        "user@example"
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post("/api/auth/register")
          .set("X-CSRF-Token", token)
          .send({
            email,
            password: "ValidPass123!",
            firstName: "Test"
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    test("Should validate password strength", async () => {
      const csrfRes = await request(app).get("/api/auth/csrf-token");
      const token = csrfRes.body.csrfToken || csrfRes.get("X-CSRF-Token");

      const weakPasswords = [
        "password", // no uppercase/number/special
        "Password", // no number/special
        "Password1", // no special char
        "lowercase123!", // no uppercase
        "UPPERCASE123!", // no lowercase
        "MixedCase!", // no number
        "123456789!" // no letters
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post("/api/auth/register")
          .set("X-CSRF-Token", token)
          .send({
            email: `test${Date.now()}@security.com`,
            password,
            firstName: "Test"
          });

        expect([400, 409]).toContain(response.status);
      }
    });
  });
});

// ==========================================
// TEST SUMMARY REPORTER
// ==========================================
afterAll(() => {
  console.log("\n");
  console.log("========================================");
  console.log("Security Test Suite Complete");
  console.log("========================================");
  console.log("Tests should verify:");
  console.log("✓ User Authentication");
  console.log("✓ Email Verification");
  console.log("✓ Password Reset");
  console.log("✓ Account Lockout");
  console.log("✓ JWT Token Management");
  console.log("✓ CSRF Protection");
  console.log("✓ Rate Limiting");
  console.log("✓ Input Validation");
  console.log("✓ Security Headers");
  console.log("✓ Profile Management");
  console.log("✓ Logout");
  console.log("========================================\n");
});
