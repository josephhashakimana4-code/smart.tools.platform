const BUSINESS_API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;
let businessCsrfToken = "";

function captureCsrfToken(response) {
  const token = response.headers.get("x-csrf-token");
  if (token) businessCsrfToken = token;
  return response;
}

async function postBusiness(path, body) {
  const tokenResponse = await fetch(`${BUSINESS_API_BASE}/api/business/plans`);
  captureCsrfToken(tokenResponse);
  const res = await fetch(`${BUSINESS_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": businessCsrfToken },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed.");
  return data;
}

async function loadPlans() {
  const grid = document.getElementById("plansGrid");
  const select = document.getElementById("checkoutPlan");
  const apiSelect = document.getElementById("apiPlan");
  if (!grid && !select && !apiSelect) return;

  const res = await fetch(`${BUSINESS_API_BASE}/api/business/plans`);
  captureCsrfToken(res);
  const data = await res.json();
  const plans = data.plans || [];

  if (grid) {
    grid.innerHTML = "";
    plans.forEach((plan) => {
      const card = document.createElement("article");
      card.className = "business-card";
      card.innerHTML = `
        <h2>${plan.name}</h2>
        <strong>${plan.currency} ${Number(plan.price || 0).toFixed(2)} / ${plan.interval}</strong>
        <p>${plan.adsRemoved ? "No ads" : "Ads shown"} / ${Number(plan.dailyLimit || 0).toLocaleString()} daily tool uses / ${Number(plan.apiLimit || 0).toLocaleString()} API calls</p>
        <ul>${(plan.features || []).map((feature) => `<li>${feature}</li>`).join("")}</ul>
        <a class="tool-btn" href="pricing.html#checkoutForm" data-smart-cta="plan-card">Start ${plan.name}</a>
      `;
      grid.appendChild(card);
    });
  }

  if (select) {
    select.innerHTML = plans.map((plan) => `<option value="${plan.slug}">${plan.name} - ${plan.currency} ${Number(plan.price || 0).toFixed(2)}</option>`).join("");
  }

  if (apiSelect) {
    const apiPlans = plans.filter((plan) => Number(plan.apiLimit || 0) > 0);
    apiSelect.innerHTML = apiPlans.map((plan) => (
      `<option value="${plan.slug}">${plan.name}: ${Number(plan.apiLimit || 0).toLocaleString()} requests/day</option>`
    )).join("");
  }
}

async function handleCheckout(event) {
  event.preventDefault();
  const message = document.getElementById("checkoutMessage");
  try {
    const data = await postBusiness("/api/business/checkout-interest", {
      name: document.getElementById("checkoutName").value,
      email: document.getElementById("checkoutEmail").value,
      planSlug: document.getElementById("checkoutPlan").value,
      gateway: document.getElementById("checkoutGateway").value
    });
    message.textContent = "Opening secure checkout...";
    if (!data.checkoutUrl) throw new Error("Checkout is not configured. Please choose Stripe after the merchant keys are set.");
    window.location.assign(data.checkoutUrl);
    event.target.reset();
  } catch (err) {
    message.textContent = err.message;
  }
}

async function handleReferral(event) {
  event.preventDefault();
  const message = document.getElementById("referralMessage");
  try {
    await postBusiness("/api/business/referrals", {
      referrerEmail: document.getElementById("referrerEmail").value,
      invitedEmail: document.getElementById("invitedEmail").value
    });
    message.textContent = "Referral saved.";
    event.target.reset();
  } catch (err) {
    message.textContent = err.message;
  }
}

async function handleAdvertise(event) {
  event.preventDefault();
  const message = document.getElementById("advertiseMessage");
  try {
    await postBusiness("/api/business/advertise", {
      company: document.getElementById("adCompany").value,
      name: document.getElementById("adName").value,
      email: document.getElementById("adEmail").value,
      placement: document.getElementById("adPlacement").value,
      budget: document.getElementById("adBudget").value,
      message: document.getElementById("adMessage").value
    });
    message.textContent = "Advertising request sent.";
    event.target.reset();
  } catch (err) {
    message.textContent = err.message;
  }
}

async function handleApiSubscription(event) {
  event.preventDefault();
  const message = document.getElementById("apiSubscriptionMessage");
  try {
    const name = document.getElementById("apiName").value;
    const email = document.getElementById("apiEmail").value;
    const planSlug = document.getElementById("apiPlan").value;
    const data = await postBusiness("/api/business/api-subscriptions", {
      name,
      email,
      planSlug
    });
    if (data.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }
    message.textContent = `API key created: ${data.subscription.apiKey}`;
    event.target.reset();
  } catch (err) {
    if (err.message === "A paid API plan requires checkout.") {
      try {
        const checkout = await postBusiness("/api/business/checkout-interest", { name, email, planSlug, gateway: "stripe" });
        window.location.assign(checkout.checkoutUrl);
        return;
      } catch (checkoutError) {
        message.textContent = checkoutError.message;
        return;
      }
    }
    message.textContent = err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadPlans().catch(() => {});
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") === "success" && params.get("session_id")) {
    const message = document.getElementById("checkoutMessage");
    const sessionId = params.get("session_id");
    const checkStatus = async () => {
      const response = await fetch(`${BUSINESS_API_BASE}/api/business/checkout-result?session_id=${encodeURIComponent(sessionId)}`);
      const data = await response.json().catch(() => ({}));
      if (data.status === "paid") {
        if (message) message.textContent = data.apiKey
          ? `Payment confirmed. Your API key: ${data.apiKey}`
          : "Payment confirmed. Your plan is active.";
        return;
      }
      if (message) message.textContent = "Payment received. Confirming your plan…";
      window.setTimeout(checkStatus, 2500);
    };
    checkStatus().catch(() => {
      if (message) message.textContent = "We could not confirm this checkout yet. Please refresh in a moment.";
    });
  }
  document.getElementById("checkoutForm")?.addEventListener("submit", handleCheckout);
  document.getElementById("referralForm")?.addEventListener("submit", handleReferral);
  document.getElementById("advertiseForm")?.addEventListener("submit", handleAdvertise);
  document.getElementById("apiSubscriptionForm")?.addEventListener("submit", handleApiSubscription);
});
