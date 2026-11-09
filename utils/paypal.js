const crypto = require("crypto");
const Plan = require("../models/Plan");

let cachedToken = "";
let tokenExpiresAt = 0;

function paypalBaseUrl() {
  if (process.env.PAYPAL_API_BASE_URL) {
    const configured = process.env.PAYPAL_API_BASE_URL.replace(/\/$/, "");
    if (!["https://api-m.paypal.com", "https://api-m.sandbox.paypal.com"].includes(configured)) {
      throw new Error("PAYPAL_API_BASE_URL must use PayPal's live or sandbox API host.");
    }
    return configured;
  }
  return process.env.NODE_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function isPaypalConfigured({ requireWebhook = true } = {}) {
  const apiBaseUrl = (process.env.PAYPAL_API_BASE_URL || "").replace(/\/$/, "");
  return Boolean(
    process.env.PAYPAL_CLIENT_ID &&
    process.env.PAYPAL_CLIENT_SECRET &&
    ["https://api-m.paypal.com", "https://api-m.sandbox.paypal.com"].includes(apiBaseUrl) &&
    process.env.APP_BASE_URL &&
    (!requireWebhook || process.env.PAYPAL_WEBHOOK_ID)
  );
}

async function getAccessToken() {
  if (cachedToken && tokenExpiresAt > Date.now() + 30_000) return cachedToken;
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "PayPal authentication failed.");
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Number(data.expires_in || 300) * 1000;
  return cachedToken;
}

async function paypalRequest(path, { method = "GET", body, requestId } = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.details?.find((item) => item.description)?.description;
    throw new Error(detail || data.message || data.name || "PayPal request failed.");
  }
  return data;
}

function amountString(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error("The plan price must be greater than zero.");
  return value.toFixed(2);
}

function currencyCode(currency) {
  const code = String(currency || "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("The plan currency must be a three-letter currency code.");
  return code;
}

async function getPaypalPlanId(plan) {
  const value = amountString(plan.price);
  const currency = currencyCode(plan.currency);
  const interval = plan.interval === "yearly" ? "YEAR" : "MONTH";
  const cacheMatches = plan.paypalPlanAmount === value &&
    plan.paypalPlanCurrency === currency &&
    plan.paypalPlanInterval === interval &&
    plan.paypalPlanId;
  if (cacheMatches) return plan.paypalPlanId;

  let productId = plan.paypalProductId;
  if (!productId) {
    const product = await paypalRequest("/v1/catalogs/products", {
      method: "POST",
      requestId: `sth-product-${plan._id}`,
      body: {
        name: `${plan.name} - Smart Tools Hub`,
        description: `Smart Tools Hub ${plan.name} subscription`,
        type: "SERVICE"
      }
    });
    productId = product.id;
    await Plan.updateOne({ _id: plan._id, $or: [{ paypalProductId: { $exists: false } }, { paypalProductId: null }, { paypalProductId: "" }] }, { $set: { paypalProductId: productId } });
    const latest = await Plan.findById(plan._id).select("paypalProductId");
    productId = latest?.paypalProductId || productId;
  }

  const signature = `${value}-${currency}-${interval}`;
  const billingPlan = await paypalRequest("/v1/billing/plans", {
    method: "POST",
    requestId: `sth-plan-${plan._id}-${signature}`,
    body: {
      product_id: productId,
      name: `${plan.name} - ${interval === "YEAR" ? "Annual" : "Monthly"}`,
      description: `Smart Tools Hub ${plan.name} plan`,
      status: "ACTIVE",
      billing_cycles: [{
        frequency: { interval_unit: interval, interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value, currency_code: currency } }
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CANCEL",
        payment_failure_threshold: 3
      }
    }
  });

  await Plan.updateOne({ _id: plan._id }, { $set: {
    paypalProductId: productId,
    paypalPlanId: billingPlan.id,
    paypalPlanAmount: value,
    paypalPlanCurrency: currency,
    paypalPlanInterval: interval
  } });
  return billingPlan.id;
}

function verifyAmount(actual, expectedAmount, expectedCurrency) {
  const expectedValue = Number(expectedAmount).toFixed(2);
  const actualCurrency = actual?.currency_code || actual?.currency;
  const actualValue = actual?.value ?? actual?.total;
  return actualCurrency === currencyCode(expectedCurrency) && Number(actualValue).toFixed(2) === expectedValue;
}

module.exports = {
  isPaypalConfigured,
  paypalBaseUrl,
  paypalRequest,
  amountString,
  currencyCode,
  getPaypalPlanId,
  verifyAmount
};
