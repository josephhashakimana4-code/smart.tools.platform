const BUSINESS_API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;

async function postBusiness(path, body) {
  const res = await fetch(`${BUSINESS_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    message.textContent = data.checkoutUrl
      ? "Payment record created. Opening checkout link..."
      : "Payment request saved. Add your gateway checkout links in Admin > Business Settings.";
    if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank");
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
    const data = await postBusiness("/api/business/api-subscriptions", {
      name: document.getElementById("apiName").value,
      email: document.getElementById("apiEmail").value,
      planSlug: document.getElementById("apiPlan").value
    });
    message.textContent = `API key created: ${data.subscription.apiKey}`;
    event.target.reset();
  } catch (err) {
    message.textContent = err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadPlans().catch(() => {});
  document.getElementById("checkoutForm")?.addEventListener("submit", handleCheckout);
  document.getElementById("referralForm")?.addEventListener("submit", handleReferral);
  document.getElementById("advertiseForm")?.addEventListener("submit", handleAdvertise);
  document.getElementById("apiSubscriptionForm")?.addEventListener("submit", handleApiSubscription);
});
