const crypto = require("crypto");

const API_BASE = "https://api.flutterwave.com/v3";

function isFlutterwaveConfigured() {
  return Boolean(process.env.FLW_SECRET_KEY && process.env.FLW_SECRET_HASH && process.env.APP_BASE_URL);
}

async function flutterwaveRequest(path, { method = "GET", body } = {}) {
  if (!process.env.FLW_SECRET_KEY) throw new Error("Flutterwave is not configured.");
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || "Flutterwave request failed.");
  }
  return data;
}

function verifyFlutterwaveWebhook(signature) {
  const secretHash = process.env.FLW_SECRET_HASH || "";
  if (!secretHash || !signature) return false;
  const received = Buffer.from(String(signature));
  const expected = Buffer.from(secretHash);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function verifyFlutterwaveAmount(actual, expected) {
  const paid = Number(actual);
  const due = Number(expected);
  return Number.isFinite(paid) && Number.isFinite(due) && paid >= due;
}

module.exports = { isFlutterwaveConfigured, flutterwaveRequest, verifyFlutterwaveWebhook, verifyFlutterwaveAmount };
