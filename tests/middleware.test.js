const express = require("express");
const request = require("supertest");
const createLimiter = require("../middlewares/rateLimiter");
const role = require("../middlewares/role");
const errorHandler = require("../middlewares/errorHandler");
const csrf = require("../middlewares/csrf");
const ErrorLog = require("../models/ErrorLog");

describe("Shared middleware", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("limits requests and applies configured slow-down delays", async () => {
    const defaultLimiterApp = express();
    defaultLimiterApp.get("/default", createLimiter(), (req, res) => res.sendStatus(200));
    await request(defaultLimiterApp).get("/default").expect(200);

    const limiterApp = express();
    limiterApp.get("/limited", createLimiter({ windowMs: 60000, max: 1 }), (req, res) => res.sendStatus(200));
    await request(limiterApp).get("/limited").expect(200);
    await request(limiterApp)
      .get("/limited")
      .expect(429)
      .expect(({ body }) => expect(body.message).toMatch(/Too many requests/));

    const scheduledDelays = [];
    jest.spyOn(global, "setTimeout").mockImplementation((callback, delay) => {
      scheduledDelays.push(delay);
      callback();
      return 0;
    });
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    const createSlowDown = createLimiter.createSlowDown;
    const defaultSlowDown = createSlowDown();
    const defaultNext = jest.fn();
    const defaultRequest = { ip: `default-${Math.random()}`, method: "POST", path: "/slow", connection: {} };
    for (let count = 0; count < 21; count++) defaultSlowDown(defaultRequest, {}, defaultNext);
    expect(scheduledDelays[0]).toBe(500);

    const configuredSlowDown = createSlowDown({ windowMs: 1000, delayAfter: 1, delayMs: 100, maxDelay: 150 });
    const configuredNext = jest.fn();
    const configuredRequest = { connection: { remoteAddress: "slow-test" }, method: "POST", path: "/configured" };
    configuredSlowDown(configuredRequest, {}, configuredNext);
    configuredSlowDown(configuredRequest, {}, configuredNext);
    configuredSlowDown(configuredRequest, {}, configuredNext);
    expect(scheduledDelays.slice(1)).toEqual([100, 150]);

    now.mockReturnValue(2501);
    configuredSlowDown(configuredRequest, {}, configuredNext);
    expect(configuredNext).toHaveBeenCalledTimes(4);
  });

  test("enforces required roles", async () => {
    const app = express();
    app.use((req, res, next) => {
      const currentRole = req.get("x-role");
      if (currentRole) req.user = { role: currentRole };
      next();
    });
    app.get("/admin", role("admin"), (req, res) => res.sendStatus(204));

    await request(app).get("/admin").expect(401);
    await request(app).get("/admin").set("X-Role", "user").expect(403);
    await request(app).get("/admin").set("X-Role", "admin").expect(204);
  });

  test("validates global CSRF tokens, bindings, expiration, and exemptions", async () => {
    const app = express();
    app.use(express.json());
    app.get("/safe", csrf.csrfProtection, (req, res) => res.sendStatus(204));
    app.post("/api/auth/csrf-token", csrf.csrfProtection, (req, res) => res.sendStatus(204));
    app.post("/protected", csrf.csrfProtection, (req, res) => res.sendStatus(204));
    app.post("/compat", csrf.generateCsrfTokenMiddleware, (req, res) => res.sendStatus(204));

    expect(csrf.isEndpointExempt("/api/auth/csrf-token")).toBe(true);
    expect(csrf.isEndpointExempt("/protected")).toBe(false);
    await request(app).get("/safe").expect(204);
    await request(app).post("/api/auth/csrf-token").expect(204);
    await request(app).post("/compat").expect(204);
    await request(app).post("/protected").expect(403);
    await request(app).post("/protected").set("X-CSRF-Token", "invalid").expect(403);

    const token = csrf.generateCsrfToken("user-1");
    expect(csrf.verifyCsrfToken(token)).toBe(true);
    expect(csrf.verifyCsrfToken(token, "user-1")).toBe(true);
    expect(csrf.verifyCsrfToken(token, "user-2")).toBe(false);
    expect(csrf.verifyCsrfToken(null)).toBe(false);
    expect(csrf.verifyCsrfToken(123)).toBe(false);

    await request(app).post("/protected").set("X-CSRF-Token", token).expect(204);
    const bodyToken = csrf.generateCsrfToken();
    await request(app).post("/protected").send({ csrfToken: bodyToken }).expect(204);
    const queryToken = csrf.generateCsrfToken();
    await request(app).post("/protected").query({ csrfToken: queryToken }).expect(204);

    expect(csrf.consumeCsrfToken(token)).toBe(true);
    expect(csrf.consumeCsrfToken(token)).toBe(false);

    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const expiredToken = csrf.generateCsrfToken();
      jest.advanceTimersByTime(60 * 60 * 1000 + 1);
      expect(csrf.verifyCsrfToken(expiredToken)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test("logs errors when possible and still returns a stable response if logging fails", async () => {
    const app = express();
    app.get("/error", (req, res, next) => next(new Error("expected error")));
    app.use(errorHandler);

    const createLog = jest.spyOn(ErrorLog, "create").mockResolvedValue({});
    const response = await request(app).get("/error").expect(500);
    expect(response.body.message).toBe("Internal Server Error");
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({
      type: "server_error",
      message: "expected error",
      path: "/error"
    }));

    createLog.mockRejectedValue(new Error("logging unavailable"));
    await request(app).get("/error").expect(500);
  });
});