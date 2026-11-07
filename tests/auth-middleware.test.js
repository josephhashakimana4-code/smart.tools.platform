const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const validateFileSignature = require("../middlewares/fileValidator");
const {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireVerified
} = require("../middlewares/jwt-auth");

const app = express();
app.get("/required", authMiddleware, (req, res) => res.json({ user: req.user }));
app.get("/optional", optionalAuthMiddleware, (req, res) => res.json({ user: req.user || null }));
app.get("/role", (req, res, next) => {
  if (req.get("x-role")) req.user = { role: req.get("x-role"), sub: "user-1" };
  next();
}, requireRole("admin"), (req, res) => res.sendStatus(204));
app.get("/verified", (req, res, next) => {
  const verified = req.get("x-verified");
  if (verified) req.user = { verified: verified === "true" };
  next();
}, requireVerified, (req, res) => res.sendStatus(204));

const userClaims = {
  _id: "user-1",
  email: "user@example.com",
  role: "user",
  plan: "free",
  verified: true,
  tokenVersion: 2
};

describe("Authentication and file validation middleware", () => {
  let readyState;

  beforeEach(() => {
    readyState = mongoose.connection.readyState;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mongoose.connection.readyState = readyState;
  });

  test("generates and verifies access and refresh tokens", () => {
    const accessToken = generateAccessToken(userClaims);
    const refresh = generateRefreshToken(userClaims);
    const tokens = generateTokens(userClaims);

    expect(verifyAccessToken(accessToken)).toMatchObject({ sub: "user-1", role: "user" });
    expect(verifyRefreshToken(refresh.token)).toMatchObject({ sub: "user-1", type: "refresh", jti: refresh.jti });
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.refreshTokenJti).toBeTruthy();
    expect(() => verifyAccessToken("invalid-token")).toThrow("Access token verification failed");

    const wrongType = jwt.sign({ sub: "user-1", type: "access" }, "test_refresh_secret_key_32_characters_min", {
      issuer: "SmartToolsHub"
    });
    expect(() => verifyRefreshToken(wrongType)).toThrow("Invalid refresh token type");
  });

  test("authenticates bearer tokens and checks current database sessions", async () => {
    await request(app).get("/required").expect(401);
    await request(app).get("/required").set("Authorization", "Basic token").expect(401);
    await request(app).get("/required").set("Authorization", "Bearer invalid").expect(401);

    const token = generateAccessToken(userClaims);
    mongoose.connection.readyState = 0;
    const noDatabase = await request(app)
      .get("/required")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(noDatabase.body.user.sub).toBe("user-1");

    mongoose.connection.readyState = 1;
    const lookup = jest.spyOn(User, "findById").mockResolvedValue(null);
    await request(app).get("/required").set("Authorization", `Bearer ${token}`).expect(401);

    lookup.mockResolvedValue({ tokenVersion: 1, activeSessions: [{ token }] });
    await request(app).get("/required").set("Authorization", `Bearer ${token}`).expect(401);

    lookup.mockResolvedValue({ tokenVersion: 2, activeSessions: [] });
    await request(app).get("/required").set("Authorization", `Bearer ${token}`).expect(401);

    lookup.mockResolvedValue({
      tokenVersion: 2,
      activeSessions: [{ token, expiresAt: Date.now() - 1 }]
    });
    await request(app).get("/required").set("Authorization", `Bearer ${token}`).expect(401);

    lookup.mockResolvedValue({ tokenVersion: 2, activeSessions: [{ token }] });
    await request(app).get("/required").set("Authorization", `Bearer ${token}`).expect(200);
  });

  test("supports optional authentication and enforces role and verification gates", async () => {
    await request(app).get("/optional").expect(200, { user: null });
    await request(app).get("/optional").set("Authorization", "Bearer invalid").expect(200, { user: null });
    const token = generateAccessToken(userClaims);
    const optional = await request(app).get("/optional").set("Authorization", `Bearer ${token}`).expect(200);
    expect(optional.body.user.sub).toBe("user-1");

    await request(app).get("/role").expect(401);
    await request(app).get("/role").set("X-Role", "user").expect(403);
    await request(app).get("/role").set("X-Role", "admin").expect(204);

    await request(app).get("/verified").expect(401);
    await request(app).get("/verified").set("X-Verified", "false").expect(403);
    await request(app).get("/verified").set("X-Verified", "true").expect(204);
  });

  test("validates PDF, DOCX, and DOC signatures and file-size limits", () => {
    expect(validateFileSignature(null)).toBe(false);
    expect(validateFileSignature({ buffer: Buffer.alloc(20), size: 20, originalname: "file.bin" })).toBe(false);
    expect(validateFileSignature({ buffer: Buffer.alloc(20), size: 20 * 1024 * 1024 + 1, originalname: "file.pdf" })).toBe(false);
    expect(validateFileSignature({ buffer: Buffer.alloc(9), size: 9, originalname: "file.pdf" })).toBe(false);

    const pdf = Buffer.alloc(12);
    pdf.write("%PDF-");
    expect(validateFileSignature({ buffer: pdf, size: pdf.length, originalname: "file.pdf" })).toBe(true);
    expect(validateFileSignature({ buffer: Buffer.alloc(12), size: 12, originalname: "file.pdf" })).toBe(false);

    const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Buffer.alloc(8)]);
    expect(validateFileSignature({ buffer: docx, size: docx.length, originalname: "file.docx" })).toBe(true);
    const doc = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, ...Buffer.alloc(8)]);
    expect(validateFileSignature({ buffer: doc, size: doc.length, originalname: "file.doc" })).toBe(true);
  });
});