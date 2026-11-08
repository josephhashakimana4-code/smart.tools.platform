const BUSINESS_API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;

async function postBusiness(path, body) {
  const res = await apiFetch(`${BUSINESS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `Request failed (${res.status}).`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

function setFormMessage(id, message, isError = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function setPlanOptions(select, plans, emptyMessage) {
  if (!select) return;
  select.replaceChildren();

  if (!plans.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyMessage;
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  plans.forEach((plan) => {
    const option = document.createElement("option");
    option.value = plan.slug;
    option.textContent = `${plan.name} - ${plan.currency || "USD"} ${Number(plan.price || 0).toFixed(2)}`;
    select.appendChild(option);
  });
}

async function loadPlans() {
  const grid = document.getElementById("plansGrid");
  const checkoutPlan = document.getElementById("checkoutPlan");
  const apiPlan = document.getElementById("apiPlan");

  try {
    const response = await fetch(`${BUSINESS_API_BASE}/api/business/plans`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `Unable to load plans (${response.status}).`);
    }

    const plans = Array.isArray(data.plans) ? data.plans : [];
    if (grid) {
      grid.replaceChildren();
      plans.forEach((plan) => {
        const card = document.createElement("article");
        card.className = "business-card";

        const title = document.createElement("h2");
        title.textContent = plan.name;
        const price = document.createElement("strong");
        price.textContent = `${plan.currency || "USD"} ${Number(plan.price || 0).toFixed(2)} / ${plan.interval || "monthly"}`;
        const details = document.createElement("p");
        details.textContent = `${plan.adsRemoved ? "No ads" : "Ads shown"} / ${Number(plan.dailyLimit || 0).toLocaleString()} daily tool uses / ${Number(plan.apiLimit || 0).toLocaleString()} API calls`;
        const features = document.createElement("ul");
        (Array.isArray(plan.features) ? plan.features : []).forEach((feature) => {
          const item = document.createElement("li");
          item.textContent = feature;
          features.appendChild(item);
        });
        const link = document.createElement("a");
        link.className = "tool-btn";
        link.href = "#checkoutForm";
        link.dataset.smartCta = "plan-card";
        link.dataset.planSlug = plan.slug;
        link.textContent = `Start ${plan.name}`;

        card.append(title, price, details, features, link);
        grid.appendChild(card);
      });

      if (!plans.length) {
        grid.textContent = "No plans are currently available.";
      }
    }

    setPlanOptions(checkoutPlan, plans, "No plans are currently available");
    setPlanOptions(
      apiPlan,
      plans.filter((plan) => Number(plan.apiLimit || 0) > 0),
      "No API plans are currently available"
    );
  } catch (error) {
    if (grid) grid.textContent = `Plans are unavailable: ${error.message}`;
    setFormMessage("checkoutMessage", `Plans are unavailable: ${error.message}`, true);
    setFormMessage("apiSubscriptionMessage", `Plans are unavailable: ${error.message}`, true);
    throw error;
  }
}

async function handleCheckout(event) {
  event.preventDefault();
  const messageId = "checkoutMessage";
  try {
    const data = await postBusiness("/api/business/checkout-interest", {
      name: document.getElementById("checkoutName").value,
      email: document.getElementById("checkoutEmail").value,
      planSlug: document.getElementById("checkoutPlan").value,
      gateway: document.getElementById("checkoutGateway").value
    });
    if (!data.checkoutUrl) {
      throw new Error("Checkout is unavailable because the payment provider did not return a checkout link.");
    }
    setFormMessage(messageId, "Opening secure checkout...");
    window.location.assign(data.checkoutUrl);
  } catch (err) {
    setFormMessage(messageId, err.message, true);
  }
}

async function handleReferral(event) {
  event.preventDefault();
  try {
    const data = await postBusiness("/api/business/referrals", {
      referrerEmail: document.getElementById("referrerEmail").value,
      invitedEmail: document.getElementById("invitedEmail").value
    });
    if (!data.success) throw new Error("The referral could not be saved.");
    setFormMessage("referralMessage", "Referral saved.");
    event.target.reset();
  } catch (err) {
    setFormMessage("referralMessage", err.message, true);
  }
}

async function handleAdvertise(event) {
  event.preventDefault();
  try {
    const data = await postBusiness("/api/business/advertise", {
      company: document.getElementById("adCompany").value,
      name: document.getElementById("adName").value,
      email: document.getElementById("adEmail").value,
      placement: document.getElementById("adPlacement").value,
      budget: document.getElementById("adBudget").value,
      message: document.getElementById("adMessage").value
    });
    if (!data.success) throw new Error("The request could not be saved.");
    setFormMessage("advertiseMessage", "Your request has been saved for review.");
    event.target.reset();
  } catch (err) {
    setFormMessage("advertiseMessage", err.message, true);
  }
}

async function handleApiSubscription(event) {
  event.preventDefault();
  const name = document.getElementById("apiName").value;
  const email = document.getElementById("apiEmail").value;
  const planSlug = document.getElementById("apiPlan").value;
  try {
    const data = await postBusiness("/api/business/api-subscriptions", {
      name,
      email,
      planSlug
    });
    if (data.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }
    if (!data.subscription?.apiKey) {
      throw new Error("The API service did not return an API key.");
    }
    setFormMessage("apiSubscriptionMessage", `API key created: ${data.subscription.apiKey}`);
    event.target.reset();
  } catch (err) {
    if (err.status === 409 && err.data?.requiresCheckout) {
      try {
        const checkout = await postBusiness("/api/business/checkout-interest", { name, email, planSlug, gateway: "stripe" });
        if (!checkout.checkoutUrl) {
          throw new Error("Checkout is unavailable because the payment provider did not return a checkout link.");
        }
        window.location.assign(checkout.checkoutUrl);
        return;
      } catch (checkoutError) {
        setFormMessage("apiSubscriptionMessage", checkoutError.message, true);
        return;
      }
    }
    setFormMessage("apiSubscriptionMessage", err.message, true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadPlans().catch((error) => console.error("Unable to load business plans:", error));
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") === "cancelled") {
    setFormMessage("checkoutMessage", "Checkout was cancelled. No payment was completed.");
  }
  if (params.get("checkout") === "success" && params.get("session_id")) {
    const sessionId = params.get("session_id");
    const checkStatus = async () => {
      const response = await fetch(`${BUSINESS_API_BASE}/api/business/checkout-result?session_id=${encodeURIComponent(sessionId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to confirm this checkout.");
      if (data.status === "paid") {
        setFormMessage("checkoutMessage", data.apiKey
          ? `Payment confirmed. Your API key: ${data.apiKey}`
          : "Payment confirmed. Your plan is active.");
        return;
      }
      if (data.status === "failed" || data.status === "refunded") {
        setFormMessage("checkoutMessage", `Payment status: ${data.status}.`, true);
        return;
      }
      setFormMessage("checkoutMessage", "Payment is not confirmed yet. Please check again shortly.");
      window.setTimeout(checkStatus, 2500);
    };
    checkStatus().catch(() => {
      setFormMessage("checkoutMessage", "We could not confirm this checkout. Please contact support before trying again.", true);
    });
  }
  document.getElementById("checkoutForm")?.addEventListener("submit", handleCheckout);
  document.getElementById("referralForm")?.addEventListener("submit", handleReferral);
  document.getElementById("advertiseForm")?.addEventListener("submit", handleAdvertise);
  document.getElementById("apiSubscriptionForm")?.addEventListener("submit", handleApiSubscription);
  document.getElementById("plansGrid")?.addEventListener("click", (event) => {
    const link = event.target.closest("[data-plan-slug]");
    if (!link) return;
    const select = document.getElementById("checkoutPlan");
    if (select && [...select.options].some((option) => option.value === link.dataset.planSlug)) {
      select.value = link.dataset.planSlug;
    }
  });
});
