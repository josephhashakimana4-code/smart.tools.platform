const express = require("express");
const request = require("supertest");
const csrf = require("../middlewares/csrf-enhanced");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.get("x-test-user")) req.user = { _id: req.get("x-test-user") };
  next();
});
app.get("/token", csrf.generateCsrfTokenMiddleware, (req, res) => {
  res.json({ token: res.locals.csrfToken, endpointToken: req.csrfTokenEndpoint });
});
app.get("/locals", csrf.csrfTokenToLocals, (req, res) => res.json({ token: res.locals.csrfToken }));
app.get("/safe", csrf.csrfProtection, (req, res) => res.sendStatus(204));
app.post("/api/auth/login", csrf.csrfProtection, (req, res) => res.sendStatus(204));
app.post("/api/admin/settings", csrf.csrfProtection, (req, res) => res.sendStatus(204));
app.post("/api/tools", csrf.csrfProtection, (req, res) => res.sendStatus(204));
app.post("/strict/api/admin/settings", csrf.requireStrictCsrf(), (req, res) => res.sendStatus(204));
app.post("/strict/regular", csrf.requireStrictCsrf(), (req, res) => res.sendStatus(204));

describe("Enhanced CSRF middleware", () => {
  test("generates, classifies, verifies, and consumes tokens", () => {
    const token = csrf.generateCsrfToken("user-1", { source: "test" });
    expect(csrf.verifyCsrfToken(token, "user-1").valid).toBe(true);
    expect(csrf.verifyCsrfToken(token, "user-2").code).toBe("CSRF_MISMATCH");
    expect(csrf.verifyCsrfToken("missing-token").code).toBe("CSRF_INVALID");

    const signature = csrf.generateRequestSignature({ endpoint: "/api/tools" });
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(csrf.isEndpointExempt("/api/auth/login")).toBe(true);
    expect(csrf.isEndpointExempt("/api/private")).toBe(false);
    expect(csrf.getEndpointCsrfLevel("/api/admin/settings")).toBe("critical");
    expect(csrf.getEndpointCsrfLevel("/api/tools/merge")).toBe("standard");
    expect(csrf.getEndpointCsrfLevel("/other")).toBe("default");

    expect(csrf.consumeCsrfToken(token)).toBe(true);
    expect(csrf.verifyCsrfToken(token).valid).toBe(true);
    expect(csrf.consumeCsrfToken(token, true)).toBe(true);
    expect(csrf.verifyCsrfToken(token).valid).toBe(false);
    expect(csrf.consumeCsrfToken("missing-token")).toBe(false);
  });

  test("skips safe and exempt requests, then enforces user-bound tokens", async () => {
    await request(app).get("/safe").expect(204);
    await request(app).post("/api/auth/login").expect(204);
    await request(app).post("/api/admin/settings").expect(403);

    const token = csrf.generateCsrfToken("user-1");
    await request(app)
      .post("/api/admin/settings")
      .set("X-Test-User", "user-2")
      .set("X-CSRF-Token", token)
      .expect(403);

    const criticalToken = csrf.generateCsrfToken("user-1");
    await request(app)
      .post("/api/admin/settings")
      .set("X-Test-User", "user-1")
      .set("X-CSRF-Token", criticalToken)
      .expect(204);
    expect(csrf.verifyCsrfToken(criticalToken).valid).toBe(false);

    const standardToken = csrf.generateCsrfToken("user-1");
    const standardRequest = () => request(app)
      .post("/api/tools")
      .set("X-Test-User", "user-1")
      .set("X-CSRF-Token", standardToken);
    await standardRequest().expect(204);
    await standardRequest().expect(204);
  });

  test("exposes generated tokens in headers and response locals", async () => {
    const generated = await request(app).get("/token").set("X-Test-User", "user-1").expect(200);
    expect(generated.headers["x-csrf-token"]).toBe(generated.body.token);
    expect(generated.body.endpointToken).toBe(generated.body.token);

    const local = await request(app).get("/locals").expect(200);
    expect(local.body.token).toMatch(/^[a-f0-9]{64}$/);
  });

  test("expires aged tokens and requires fresh tokens for strict critical requests", async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const standard = csrf.generateCsrfToken();
      const strict = csrf.generateCsrfToken();

      await request(app)
        .post("/strict/api/admin/settings")
        .set("X-CSRF-Token", strict)
        .expect(204);

      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      await request(app)
        .post("/strict/api/admin/settings")
        .set("X-CSRF-Token", strict)
        .expect(403);

      jest.advanceTimersByTime(55 * 60 * 1000);
      expect(csrf.verifyCsrfToken(standard).code).toBe("CSRF_EXPIRED");

      await request(app).post("/strict/regular").expect(204);
    } finally {
      jest.useRealTimers();
    }
  });
});