jest.mock("../middlewares/jwt-auth", () => ({
  authMiddleware: (req, res, next) => {
    req.user = { _id: req.get("x-test-user") || "verification-user", role: "user" };
    next();
  }
}));

const express = require("express");
const request = require("supertest");
const verificationRouter = require("../routes/verification");
const {
  generateVerificationSession,
  verifyOTP,
  getVerificationSession,
  completeVerification,
  requireSecondVerification
} = require("../middlewares/two-factor");

const app = express();
app.use(express.json());
app.use("/api/auth/verification", verificationRouter);

describe("Second verification", () => {
  test("initiates, verifies, and reports a session only to its owner", async () => {
    await request(app)
      .post("/api/auth/verification/initiate")
      .send({})
      .expect(400);

    await request(app)
      .post("/api/auth/verification/initiate")
      .send({ operation: "unknown-operation" })
      .expect(400);

    const initiated = await request(app)
      .post("/api/auth/verification/initiate")
      .send({ operation: "password-change" })
      .expect(200);
    const { sessionId, _testOtp: otp } = initiated.body;

    await request(app)
      .get(`/api/auth/verification/status/${sessionId}`)
      .set("X-Test-User", "another-user")
      .expect(403);

    const invalid = await request(app)
      .post("/api/auth/verification/verify")
      .send({ sessionId, otp: "000000" })
      .expect(403);
    expect(invalid.body.attemptsRemaining).toBe(2);

    const verified = await request(app)
      .post("/api/auth/verification/verify")
      .send({ sessionId, otp })
      .expect(200);
    expect(verified.body.verified).toBe(true);

    const status = await request(app)
      .get(`/api/auth/verification/status/${sessionId}`)
      .expect(200);
    expect(status.body.verified).toBe(true);
    expect(status.body.operation).toBe("password-change");
  });

  test("handles missing, throttled, and cancelled verification sessions", async () => {
    await request(app)
      .post("/api/auth/verification/verify")
      .send({})
      .expect(400);

    await request(app)
      .get("/api/auth/verification/status/missing-session")
      .expect(404);

    const initiated = await request(app)
      .post("/api/auth/verification/initiate")
      .send({ operation: "email-change" })
      .expect(200);
    const sessionId = initiated.body.sessionId;

    await request(app)
      .post("/api/auth/verification/resend")
      .send({ sessionId })
      .expect(429);

    const cancelled = await request(app)
      .post("/api/auth/verification/cancel")
      .send({ sessionId })
      .expect(200);
    expect(cancelled.body.success).toBe(true);

    await request(app)
      .post("/api/auth/verification/cancel")
      .send({ sessionId })
      .expect(404);
  });

  test("expires OTPs, enforces attempt limits, and consumes completed sessions", () => {
    const attemptLimited = generateVerificationSession("attempt-user");
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(verifyOTP(attemptLimited.sessionId, "wrong").success).toBe(false);
    }
    expect(verifyOTP(attemptLimited.sessionId, attemptLimited.otp).message).toContain("Maximum");
    expect(getVerificationSession(attemptLimited.sessionId)).toBeNull();

    const otpExpired = generateVerificationSession("expired-otp-user");
    getVerificationSession(otpExpired.sessionId).otpExpires = Date.now() - 1;
    expect(verifyOTP(otpExpired.sessionId, otpExpired.otp).message).toContain("OTP expired");

    const sessionExpired = generateVerificationSession("expired-session-user");
    getVerificationSession(sessionExpired.sessionId).sessionExpires = Date.now() - 1;
    expect(getVerificationSession(sessionExpired.sessionId)).toBeNull();

    const unverified = generateVerificationSession("unverified-user");
    expect(completeVerification(unverified.sessionId)).toBe(false);
    expect(getVerificationSession(unverified.sessionId)).toBeNull();

    const completed = generateVerificationSession("completed-user");
    expect(verifyOTP(completed.sessionId, completed.otp).success).toBe(true);
    expect(completeVerification(completed.sessionId)).toBe(true);
    expect(completeVerification(completed.sessionId)).toBe(false);
  });

  test("requires a verified session only for configured sensitive requests", async () => {
    const guardedApp = express();
    guardedApp.use(express.json());
    guardedApp.use((req, res, next) => {
      req.user = { _id: req.get("x-test-user") || "guarded-user", role: req.get("x-test-role") || "user" };
      next();
    });
    guardedApp.post("/change", requireSecondVerification({ operations: ["password-change"] }), (req, res) => {
      res.json({ verified: Boolean(req.verification) });
    });
    guardedApp.get("/change", requireSecondVerification({ operations: ["password-change"] }), (req, res) => {
      res.sendStatus(204);
    });

    await request(guardedApp)
      .post("/change")
      .send({ operation: "password-change" })
      .expect(403);

    const pending = generateVerificationSession("guarded-user");
    await request(guardedApp)
      .post("/change")
      .set("X-Verification-Session", pending.sessionId)
      .send({ operation: "password-change" })
      .expect(403);

    const verified = generateVerificationSession("another-user");
    verifyOTP(verified.sessionId, verified.otp);
    await request(guardedApp)
      .post("/change")
      .set("X-Verification-Session", verified.sessionId)
      .send({ operation: "password-change" })
      .expect(403);

    const owned = generateVerificationSession("guarded-user");
    verifyOTP(owned.sessionId, owned.otp);
    const success = await request(guardedApp)
      .post("/change")
      .set("X-Verification-Session", owned.sessionId)
      .send({ operation: "password-change" })
      .expect(200);
    expect(success.body.verified).toBe(true);
    expect(getVerificationSession(owned.sessionId)).toBeNull();

    await request(guardedApp)
      .get("/change")
      .expect(204);

    await request(guardedApp)
      .post("/change")
      .set("X-Test-Role", "guest")
      .send({ operation: "password-change" })
      .expect(200);

    await request(guardedApp)
      .post("/change")
      .send({ operation: "safe-operation" })
      .expect(200);
  });
});