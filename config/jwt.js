const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  "change_this_access_secret";

const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "change_this_refresh_secret";

const ACCESS_EXPIRES =
  process.env.JWT_ACCESS_EXPIRES || "15m";

const REFRESH_EXPIRES =
  process.env.JWT_REFRESH_EXPIRES || "30d";

const ISSUER =
  process.env.JWT_ISSUER || "SmartToolsHub";

const AUDIENCE =
  process.env.JWT_AUDIENCE || "SmartToolsHubUsers";

function buildPayload(user = {}) {
  return {
    sub: String(user._id),
    email: user.email || "",
    role: user.role || "user",
    plan: user.plan || "free",
    verified: Boolean(user.verified),
    tokenVersion: user.tokenVersion || 0
  };
}

function signAccessToken(user) {
  return jwt.sign(
    buildPayload(user),
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_EXPIRES,
      issuer: ISSUER,
      audience: AUDIENCE,
      jwtid: crypto.randomUUID()
    }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      tokenVersion: user.tokenVersion || 0
    },
    REFRESH_SECRET,
    {
      expiresIn: REFRESH_EXPIRES,
      issuer: ISSUER,
      audience: AUDIENCE,
      jwtid: crypto.randomUUID()
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE
  });
}

function generateTokenPair(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    expiresIn: ACCESS_EXPIRES,
    refreshExpiresIn: REFRESH_EXPIRES
  };
}

function decodeToken(token) {
  return jwt.decode(token, { complete: true });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  decodeToken
};
