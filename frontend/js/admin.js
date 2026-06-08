const API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;
const TOKEN_KEY = "smartToolsAdminToken";

let tools = [];
let categories = [];
let monetizationRows = [];
let ads = [];
let blogPosts = [];
let businessData = null;
let dailyVisitorsChart = null;
let toolViewsChart = null;
let adminToken = localStorage.getItem(TOKEN_KEY) || "";

const els = {
  loginScreen: document.getElementById("loginScreen"),
  adminApp: document.getElementById("adminApp"),
  loginForm: document.getElementById("loginForm"),
  adminPassword: document.getElementById("adminPassword"),
  loginMessage: document.getElementById("loginMessage"),
  logoutBtn: document.getElementById("logoutBtn"),
  refreshAllBtn: document.getElementById("refreshAllBtn"),
  menuButtons: document.querySelectorAll(".menu-btn"),
  sections: document.querySelectorAll(".admin-section"),
  totalTools: document.getElementById("totalTools"),
  activeTools: document.getElementById("activeTools"),
  viewCount: document.getElementById("viewCount"),
  affiliateClickCount: document.getElementById("affiliateClickCount"),
  affiliateCtr: document.getElementById("affiliateCtr"),
  downloadCount: document.getElementById("downloadCount"),
  visitorsToday: document.getElementById("visitorsToday"),
  visitorsMonth: document.getElementById("visitorsMonth"),
  adClickCount: document.getElementById("adClickCount"),
  estimatedEarnings: document.getElementById("estimatedEarnings"),
  paidRevenue: document.getElementById("paidRevenue"),
  monthlyRevenue: document.getElementById("monthlyRevenue"),
  subscriberCount: document.getElementById("subscriberCount"),
  unreadContactCount: document.getElementById("unreadContactCount"),
  topViewedList: document.getElementById("topViewedList"),
  topAffiliateList: document.getElementById("topAffiliateList"),
  countriesList: document.getElementById("countriesList"),
  searchAnalyticsList: document.getElementById("searchAnalyticsList"),
  businessPlansCount: document.getElementById("businessPlansCount"),
  apiSubscriptionsCount: document.getElementById("apiSubscriptionsCount"),
  pendingReferralsCount: document.getElementById("pendingReferralsCount"),
  openAdLeadsCount: document.getElementById("openAdLeadsCount"),
  gatewayRevenueList: document.getElementById("gatewayRevenueList"),
  planRevenueList: document.getElementById("planRevenueList"),
  plansTable: document.getElementById("plansTable"),
  planForm: document.getElementById("planForm"),
  planFormTitle: document.getElementById("planFormTitle"),
  planId: document.getElementById("planId"),
  planName: document.getElementById("planName"),
  planSlug: document.getElementById("planSlug"),
  planPrice: document.getElementById("planPrice"),
  planCurrency: document.getElementById("planCurrency"),
  planInterval: document.getElementById("planInterval"),
  planDailyLimit: document.getElementById("planDailyLimit"),
  planApiLimit: document.getElementById("planApiLimit"),
  planAdsRemoved: document.getElementById("planAdsRemoved"),
  planActive: document.getElementById("planActive"),
  planFeatures: document.getElementById("planFeatures"),
  resetPlanBtn: document.getElementById("resetPlanBtn"),
  paymentsTable: document.getElementById("paymentsTable"),
  paymentForm: document.getElementById("paymentForm"),
  paymentCustomerName: document.getElementById("paymentCustomerName"),
  paymentCustomerEmail: document.getElementById("paymentCustomerEmail"),
  paymentPlanSlug: document.getElementById("paymentPlanSlug"),
  paymentGateway: document.getElementById("paymentGateway"),
  paymentAmount: document.getElementById("paymentAmount"),
  paymentCurrency: document.getElementById("paymentCurrency"),
  paymentStatus: document.getElementById("paymentStatus"),
  paymentReference: document.getElementById("paymentReference"),
  apiSubscriptionsList: document.getElementById("apiSubscriptionsList"),
  referralsList: document.getElementById("referralsList"),
  directAdLeadsList: document.getElementById("directAdLeadsList"),
  businessSettingsForm: document.getElementById("businessSettingsForm"),
  brandName: document.getElementById("brandName"),
  logoUrl: document.getElementById("logoUrl"),
  defaultCurrency: document.getElementById("defaultCurrency"),
  paypalAccountEmail: document.getElementById("paypalAccountEmail"),
  paymentInstructions: document.getElementById("paymentInstructions"),
  paypalUrl: document.getElementById("paypalUrl"),
  stripeUrl: document.getElementById("stripeUrl"),
  flutterwaveUrl: document.getElementById("flutterwaveUrl"),
  paystackUrl: document.getElementById("paystackUrl"),
  adsensePublisherId: document.getElementById("adsensePublisherId"),
  propellerAdsCode: document.getElementById("propellerAdsCode"),
  adsterraCode: document.getElementById("adsterraCode"),
  supportedLanguages: document.getElementById("supportedLanguages"),
  youtubeUrl: document.getElementById("youtubeUrl"),
  facebookUrl: document.getElementById("facebookUrl"),
  linkedinUrl: document.getElementById("linkedinUrl"),
  monetizationTable: document.getElementById("monetizationTable"),
  adsTable: document.getElementById("adsTable"),
  adForm: document.getElementById("adForm"),
  adFormTitle: document.getElementById("adFormTitle"),
  adId: document.getElementById("adId"),
  adTitle: document.getElementById("adTitle"),
  adImage: document.getElementById("adImage"),
  adUrl: document.getElementById("adUrl"),
  adPosition: document.getElementById("adPosition"),
  adActive: document.getElementById("adActive"),
  resetAdBtn: document.getElementById("resetAdBtn"),
  blogTable: document.getElementById("blogTable"),
  blogForm: document.getElementById("blogForm"),
  blogFormTitle: document.getElementById("blogFormTitle"),
  blogId: document.getElementById("blogId"),
  blogTitle: document.getElementById("blogTitle"),
  blogSlug: document.getElementById("blogSlug"),
  blogStatus: document.getElementById("blogStatus"),
  blogExcerpt: document.getElementById("blogExcerpt"),
  blogContent: document.getElementById("blogContent"),
  blogMetaTitle: document.getElementById("blogMetaTitle"),
  blogMetaDescription: document.getElementById("blogMetaDescription"),
  resetBlogBtn: document.getElementById("resetBlogBtn"),
  subscribersList: document.getElementById("subscribersList"),
  contactStatusFilter: document.getElementById("contactStatusFilter"),
  contactList: document.getElementById("contactList"),
  errorsList: document.getElementById("errorsList"),
  toolsSummary: document.getElementById("toolsSummary"),
  toolsTable: document.getElementById("toolsTable"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  refreshBtn: document.getElementById("refreshBtn"),
  newToolBtn: document.getElementById("newToolBtn"),
  form: document.getElementById("toolForm"),
  formTitle: document.getElementById("formTitle"),
  formHint: document.getElementById("formHint"),
  message: document.getElementById("message"),
  resetBtn: document.getElementById("resetBtn"),
  resetMetricsBtn: document.getElementById("resetMetricsBtn"),
  toolId: document.getElementById("toolId"),
  name: document.getElementById("name"),
  slug: document.getElementById("slug"),
  category: document.getElementById("category"),
  status: document.getElementById("status"),
  description: document.getElementById("description"),
  metaTitle: document.getElementById("metaTitle"),
  metaDescription: document.getElementById("metaDescription"),
  metaKeywords: document.getElementById("metaKeywords"),
  ogImage: document.getElementById("ogImage"),
  canonicalUrl: document.getElementById("canonicalUrl"),
  affiliateUrl: document.getElementById("affiliateUrl"),
  affiliateLabel: document.getElementById("affiliateLabel"),
  affiliateCategory: document.getElementById("affiliateCategory")
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function money(value, currency = "USD") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function number(value) {
  return Number(value || 0).toLocaleString();
}

function setMessage(text, isError = false) {
  els.message.textContent = text;
  els.message.classList.toggle("error", isError);
}

function setLoginMessage(text) {
  els.loginMessage.textContent = text;
}

function showAdmin() {
  els.loginScreen.classList.add("hidden");
  els.adminApp.classList.remove("hidden");
}

function showLogin() {
  els.adminApp.classList.add("hidden");
  els.loginScreen.classList.remove("hidden");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-token": adminToken
  };
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    headers: authHeaders(),
    ...options
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    adminToken = "";
    showLogin();
    throw new Error(data.message || "Admin login required.");
  }

  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

async function login(event) {
  event.preventDefault();
  setLoginMessage("");

  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: els.adminPassword.value })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.message || "Login failed.");

    adminToken = data.token;
    localStorage.setItem(TOKEN_KEY, adminToken);
    els.adminPassword.value = "";
    showAdmin();
    await refreshDashboard();
  } catch (err) {
    setLoginMessage(err.message);
  }
}

async function logout() {
  if (adminToken) {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: "POST",
      headers: authHeaders()
    }).catch(() => {});
  }
  localStorage.removeItem(TOKEN_KEY);
  adminToken = "";
  showLogin();
}

async function loadStats() {
  const stats = await requestJson(`${API_BASE}/api/admin/stats`);
  els.totalTools.textContent = number(stats.total);
  els.activeTools.textContent = number(stats.active);
  els.viewCount.textContent = number(stats.views);
  els.affiliateClickCount.textContent = number(stats.affiliateClicks);
  els.affiliateCtr.textContent = `${stats.affiliateCtr || 0}%`;
  els.downloadCount.textContent = number(stats.downloads.totalDownloads);
  els.visitorsToday.textContent = number(stats.visitorsToday);
  els.visitorsMonth.textContent = number(stats.visitorsMonth);
  els.adClickCount.textContent = number(stats.adClicks);
  els.estimatedEarnings.textContent = `$${Number(stats.estimatedEarnings || 0).toFixed(2)}`;
  els.subscriberCount.textContent = number(stats.subscribers);
  els.unreadContactCount.textContent = number(stats.contactsUnread);
  categories = stats.categories.map((item) => item._id).filter(Boolean);
  renderCategoryFilter();
  renderRankList(els.topViewedList, stats.topViewed, "views");
  renderRankList(els.topAffiliateList, stats.topAffiliate, "affiliateClicks");
}

function renderSimpleList(container, rows = [], emptyText = "No data yet.") {
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = `<p class="muted">${emptyText}</p>`;
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "rank-item";
    item.innerHTML = `
      <div><strong>${row.label}</strong><span class="muted">${row.sub || ""}</span></div>
      <div class="rank-metrics">${row.value || ""}</div>
    `;
    container.appendChild(item);
  });
}

function drawChart(existingChart, id, labels, values, label) {
  if (!window.Chart) return existingChart;
  const canvas = document.getElementById(id);
  if (!canvas) return existingChart;
  if (existingChart) existingChart.destroy();
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        borderColor: "#1d4ed8",
        backgroundColor: "rgba(29, 78, 216, 0.12)",
        tension: 0.25,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

async function loadAnalytics() {
  const data = await requestJson(`${API_BASE}/api/admin/analytics`);
  dailyVisitorsChart = drawChart(
    dailyVisitorsChart,
    "dailyVisitorsChart",
    data.dailyVisitors.map((row) => row._id),
    data.dailyVisitors.map((row) => row.count),
    "Daily visitors"
  );
  toolViewsChart = drawChart(
    toolViewsChart,
    "toolViewsChart",
    data.toolViews.map((row) => row.name),
    data.toolViews.map((row) => row.views || 0),
    "Views per tool"
  );
  renderSimpleList(els.countriesList, data.topCountries.map((row) => ({
    label: row._id || "Unknown",
    value: number(row.count)
  })), "No country analytics yet.");
  renderSimpleList(els.searchAnalyticsList, [
    ...data.searches.map((row) => ({ label: row._id, sub: "Most searched", value: number(row.count) })),
    ...data.noResultSearches.map((row) => ({ label: row._id, sub: "No result search", value: number(row.count) }))
  ], "Search data appears after visitors use search.");
}

async function loadBusiness() {
  businessData = await requestJson(`${API_BASE}/api/admin/business`);
  const currency = businessData.settings?.defaultCurrency || "USD";
  els.paidRevenue.textContent = money(businessData.summary.totalRevenue, currency);
  els.monthlyRevenue.textContent = money(businessData.summary.monthlyRevenue, currency);
  els.businessPlansCount.textContent = number(businessData.summary.activePlans);
  els.apiSubscriptionsCount.textContent = number(businessData.summary.activeApiSubscriptions);
  els.pendingReferralsCount.textContent = number(businessData.summary.pendingReferrals);
  els.openAdLeadsCount.textContent = number(businessData.summary.openAdLeads);

  renderSimpleList(els.gatewayRevenueList, businessData.revenueByGateway.map((row) => ({
    label: row._id || "manual",
    sub: `${number(row.count)} payment(s)`,
    value: money(row.total, currency)
  })), "No paid gateway revenue yet.");
  renderSimpleList(els.planRevenueList, businessData.revenueByPlan.map((row) => ({
    label: row._id || "unknown",
    sub: `${number(row.count)} payment(s)`,
    value: money(row.total, currency)
  })), "No paid plan revenue yet.");

  renderPlans();
  renderPayments();
  renderApiSubscriptions();
  renderReferrals();
  renderDirectAdLeads();
  fillBusinessSettings();
}

function renderPlans() {
  els.plansTable.innerHTML = businessData.plans.length ? "" : `<tr><td colspan="5" class="muted">No plans created yet.</td></tr>`;
  businessData.plans.forEach((plan) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><div class="tool-name">${plan.name}</div><div class="tool-slug">${plan.slug}</div></td>
      <td>${money(plan.price, plan.currency)} / ${plan.interval}</td>
      <td>${number(plan.dailyLimit)} tools<br>${number(plan.apiLimit)} API</td>
      <td><span class="badge ${plan.active ? "" : "inactive"}">${plan.active ? "active" : "inactive"}</span></td>
      <td><div class="row-actions"><button class="small-btn" data-action="edit-plan" data-id="${plan._id}">Edit</button><button class="danger-btn" data-action="delete-plan" data-id="${plan._id}">Delete</button></div></td>
    `;
    els.plansTable.appendChild(row);
  });
}

function resetPlanForm() {
  els.planForm.reset();
  els.planId.value = "";
  els.planPrice.value = "0";
  els.planCurrency.value = businessData?.settings?.defaultCurrency || "USD";
  els.planDailyLimit.value = "100";
  els.planApiLimit.value = "100";
  els.planActive.checked = true;
  els.planFormTitle.textContent = "Create Plan";
}

function fillPlanForm(plan) {
  els.planId.value = plan._id;
  els.planName.value = plan.name || "";
  els.planSlug.value = plan.slug || "";
  els.planPrice.value = plan.price || 0;
  els.planCurrency.value = plan.currency || "USD";
  els.planInterval.value = plan.interval || "monthly";
  els.planDailyLimit.value = plan.dailyLimit || 0;
  els.planApiLimit.value = plan.apiLimit || 0;
  els.planAdsRemoved.checked = Boolean(plan.adsRemoved);
  els.planActive.checked = plan.active !== false;
  els.planFeatures.value = (plan.features || []).join("\n");
  els.planFormTitle.textContent = `Edit ${plan.name}`;
}

async function savePlan(event) {
  event.preventDefault();
  const id = els.planId.value;
  const payload = {
    name: els.planName.value.trim(),
    slug: slugify(els.planSlug.value || els.planName.value),
    price: Number(els.planPrice.value || 0),
    currency: els.planCurrency.value.trim(),
    interval: els.planInterval.value,
    dailyLimit: Number(els.planDailyLimit.value || 0),
    apiLimit: Number(els.planApiLimit.value || 0),
    adsRemoved: els.planAdsRemoved.checked,
    active: els.planActive.checked,
    features: els.planFeatures.value
  };
  await requestJson(`${API_BASE}/api/admin/business/plans${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });
  resetPlanForm();
  await refreshDashboard();
}

function renderPayments() {
  els.paymentsTable.innerHTML = businessData.payments.length ? "" : `<tr><td colspan="5" class="muted">No payments recorded yet.</td></tr>`;
  businessData.payments.forEach((payment) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><div class="tool-name">${payment.customerName || "Customer"}</div><div class="tool-slug">${payment.customerEmail || ""}</div></td>
      <td>${payment.planSlug || "-"}</td>
      <td>${money(payment.amount, payment.currency)}<br><span class="muted">${payment.gateway}</span></td>
      <td><span class="badge ${payment.status === "paid" ? "" : payment.status === "pending" ? "warning" : "inactive"}">${payment.status}</span></td>
      <td><div class="row-actions"><button class="small-btn" data-action="payment-status" data-id="${payment._id}" data-status="paid">Paid</button><button class="secondary-btn" data-action="payment-status" data-id="${payment._id}" data-status="refunded">Refund</button></div></td>
    `;
    els.paymentsTable.appendChild(row);
  });
}

async function savePayment(event) {
  event.preventDefault();
  await requestJson(`${API_BASE}/api/admin/business/payments`, {
    method: "POST",
    body: JSON.stringify({
      customerName: els.paymentCustomerName.value.trim(),
      customerEmail: els.paymentCustomerEmail.value.trim(),
      planSlug: els.paymentPlanSlug.value.trim(),
      gateway: els.paymentGateway.value,
      amount: Number(els.paymentAmount.value || 0),
      currency: els.paymentCurrency.value.trim(),
      status: els.paymentStatus.value,
      reference: els.paymentReference.value.trim()
    })
  });
  els.paymentForm.reset();
  els.paymentCurrency.value = businessData?.settings?.defaultCurrency || "USD";
  await refreshDashboard();
}

function renderApiSubscriptions() {
  renderSimpleList(els.apiSubscriptionsList, businessData.apiSubscriptions.map((item) => ({
    label: item.ownerEmail || item.ownerName || "API user",
    sub: `${item.planSlug} / ${item.apiKey}`,
    value: `${item.status} / ${number(item.usedToday)} of ${number(item.dailyLimit)}`
  })), "No API subscriptions yet.");
}

function renderReferrals() {
  els.referralsList.innerHTML = businessData.referrals.length ? "" : `<p class="muted">No referrals yet.</p>`;
  businessData.referrals.forEach((referral) => {
    const item = document.createElement("div");
    item.className = "rank-item";
    item.innerHTML = `
      <div><strong>${referral.referrerEmail}</strong><span class="muted">Invited ${referral.invitedEmail} / ${referral.rewardValue} ${referral.rewardType}</span></div>
      <div class="row-actions"><span class="badge ${referral.status === "pending" ? "warning" : ""}">${referral.status}</span><button class="small-btn" data-action="referral-status" data-id="${referral._id}" data-status="approved">Approve</button><button class="secondary-btn" data-action="referral-status" data-id="${referral._id}" data-status="paid">Paid</button></div>
    `;
    els.referralsList.appendChild(item);
  });
}

function renderDirectAdLeads() {
  els.directAdLeadsList.innerHTML = businessData.directAdLeads.length ? "" : `<p class="muted">No direct advertising leads yet.</p>`;
  businessData.directAdLeads.forEach((lead) => {
    const item = document.createElement("div");
    item.className = "rank-item message-item";
    item.innerHTML = `
      <div><strong>${lead.company || lead.name || "Advertiser"}</strong><span class="muted">${lead.email} / ${lead.placement || "placement"} / ${money(lead.budget, businessData.settings?.defaultCurrency || "USD")}</span><p>${lead.message || ""}</p></div>
      <div class="row-actions"><span class="badge ${lead.status === "new" ? "warning" : ""}">${lead.status}</span><button class="small-btn" data-action="ad-lead-status" data-id="${lead._id}" data-status="contacted">Contacted</button><button class="small-btn" data-action="ad-lead-status" data-id="${lead._id}" data-status="won">Won</button><button class="secondary-btn" data-action="ad-lead-status" data-id="${lead._id}" data-status="archived">Archive</button></div>
    `;
    els.directAdLeadsList.appendChild(item);
  });
}

function fillBusinessSettings() {
  const settings = businessData.settings || {};
  els.brandName.value = settings.brandName || "Smart Tools Hub";
  els.logoUrl.value = settings.logoUrl || "";
  els.defaultCurrency.value = settings.defaultCurrency || "USD";
  els.paypalAccountEmail.value = settings.paypalAccountEmail || "";
  els.paymentInstructions.value = settings.paymentInstructions || "";
  els.paypalUrl.value = settings.paypalUrl || "";
  els.stripeUrl.value = settings.stripeUrl || "";
  els.flutterwaveUrl.value = settings.flutterwaveUrl || "";
  els.paystackUrl.value = settings.paystackUrl || "";
  els.adsensePublisherId.value = settings.adsensePublisherId || "";
  els.propellerAdsCode.value = settings.propellerAdsCode || "";
  els.adsterraCode.value = settings.adsterraCode || "";
  els.supportedLanguages.value = (settings.supportedLanguages || []).join(", ");
  els.youtubeUrl.value = settings.socialLinks?.youtube || "";
  els.facebookUrl.value = settings.socialLinks?.facebook || "";
  els.linkedinUrl.value = settings.socialLinks?.linkedin || "";
}

async function saveBusinessSettings(event) {
  event.preventDefault();
  await requestJson(`${API_BASE}/api/admin/business/settings`, {
    method: "PUT",
    body: JSON.stringify({
      brandName: els.brandName.value.trim(),
      logoUrl: els.logoUrl.value.trim(),
      defaultCurrency: els.defaultCurrency.value.trim(),
      paypalAccountEmail: els.paypalAccountEmail.value.trim(),
      paymentInstructions: els.paymentInstructions.value.trim(),
      paypalUrl: els.paypalUrl.value.trim(),
      stripeUrl: els.stripeUrl.value.trim(),
      flutterwaveUrl: els.flutterwaveUrl.value.trim(),
      paystackUrl: els.paystackUrl.value.trim(),
      adsensePublisherId: els.adsensePublisherId.value.trim(),
      propellerAdsCode: els.propellerAdsCode.value.trim(),
      adsterraCode: els.adsterraCode.value.trim(),
      supportedLanguages: els.supportedLanguages.value.trim(),
      youtube: els.youtubeUrl.value.trim(),
      facebook: els.facebookUrl.value.trim(),
      linkedin: els.linkedinUrl.value.trim()
    })
  });
  await refreshDashboard();
}

function renderRankList(container, rows = [], metric) {
  container.innerHTML = "";
  const usefulRows = rows.filter((row) => Number(row[metric] || 0) > 0);

  if (!usefulRows.length) {
    container.innerHTML = `<p class="muted">No activity yet. Open tool pages and click affiliate links to start tracking.</p>`;
    return;
  }

  usefulRows.forEach((tool) => {
    const item = document.createElement("div");
    item.className = "rank-item";
    item.innerHTML = `
      <div>
        <strong>${tool.name}</strong>
        <span class="muted">${tool.category} / ${tool.slug}</span>
      </div>
      <div class="rank-metrics">${number(tool.views)} views<br>${number(tool.affiliateClicks)} clicks</div>
    `;
    container.appendChild(item);
  });
}

function renderCategoryFilter() {
  const current = els.categoryFilter.value;
  els.categoryFilter.innerHTML = `<option value="all">All categories</option>`;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.appendChild(option);
  });

  if ([...els.categoryFilter.options].some((option) => option.value === current)) {
    els.categoryFilter.value = current;
  }
}

async function loadTools() {
  const params = new URLSearchParams({
    q: els.searchInput.value.trim(),
    status: els.statusFilter.value,
    category: els.categoryFilter.value
  });
  tools = await requestJson(`${API_BASE}/api/admin/tools?${params.toString()}`);
  renderTools();
}

function renderTools() {
  els.toolsTable.innerHTML = "";
  els.toolsSummary.textContent = `${tools.length} tool${tools.length === 1 ? "" : "s"} shown`;

  if (!tools.length) {
    els.toolsTable.innerHTML = `<tr><td colspan="6" class="muted">No tools match your filters.</td></tr>`;
    return;
  }

  tools.forEach((tool) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><div class="tool-name">${tool.name}</div><div class="tool-slug">${tool.slug}</div></td>
      <td>${tool.category}</td>
      <td><span class="badge ${tool.status === "inactive" ? "inactive" : ""}">${tool.status}</span></td>
      <td>${number(tool.views)}</td>
      <td>${number(tool.affiliateClicks)}</td>
      <td>
        <div class="row-actions">
          <button class="small-btn" data-action="edit" data-id="${tool._id}">Edit</button>
          <button class="small-btn" data-action="view" data-slug="${tool.slug}">View</button>
          <button class="secondary-btn" data-action="toggle" data-id="${tool._id}">
            ${tool.status === "active" ? "Deactivate" : "Activate"}
          </button>
          <button class="danger-btn" data-action="delete" data-id="${tool._id}">Delete</button>
        </div>
      </td>
    `;
    els.toolsTable.appendChild(row);
  });
}

async function loadMonetization() {
  monetizationRows = await requestJson(`${API_BASE}/api/admin/monetization`);
  renderMonetization();
}

function renderMonetization() {
  els.monetizationTable.innerHTML = "";

  if (!monetizationRows.length) {
    els.monetizationTable.innerHTML = `<tr><td colspan="6" class="muted">No monetization rows found.</td></tr>`;
    return;
  }

  monetizationRows.forEach((tool) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><div class="tool-name">${tool.name}</div><div class="tool-slug">${tool.slug}</div></td>
      <td><span class="badge ${tool.status === "inactive" ? "inactive" : ""}">${tool.status}</span></td>
      <td>${number(tool.views)}</td>
      <td>${number(tool.affiliateClicks)}</td>
      <td>${tool.ctr}%</td>
      <td>
        ${tool.hasAffiliate
          ? `<span class="badge">${tool.affiliateLabel || "Affiliate set"}</span>`
          : `<span class="badge warning">Missing link</span>`}
      </td>
    `;
    els.monetizationTable.appendChild(row);
  });
}

function resetForm() {
  els.form.reset();
  els.toolId.value = "";
  els.status.value = "active";
  els.category.value = "utility";
  els.formTitle.textContent = "Create Tool";
  els.formHint.textContent = "Fill the fields and save to MongoDB.";
  setMessage("");
}

function fillForm(tool) {
  els.toolId.value = tool._id;
  els.name.value = tool.name || "";
  els.slug.value = tool.slug || "";
  els.category.value = tool.category || "utility";
  els.status.value = tool.status || "active";
  els.description.value = tool.description || "";
  els.affiliateUrl.value = tool.affiliateUrl || "";
  els.affiliateLabel.value = tool.affiliateLabel || "";
  els.affiliateCategory.value = tool.affiliateCategory || "";
  els.metaTitle.value = tool.metaTitle || "";
  els.metaDescription.value = tool.metaDescription || "";
  els.metaKeywords.value = tool.metaKeywords || "";
  els.ogImage.value = tool.ogImage || "";
  els.canonicalUrl.value = tool.canonicalUrl || "";
  els.formTitle.textContent = `Edit ${tool.name}`;
  els.formHint.textContent = "Changes update the MongoDB tool record after saving.";
  setMessage("");
  activateSection("tools");
}

function readForm() {
  return {
    name: els.name.value.trim(),
    slug: slugify(els.slug.value || els.name.value),
    category: els.category.value,
    status: els.status.value,
    description: els.description.value.trim(),
    metaTitle: els.metaTitle.value.trim(),
    metaDescription: els.metaDescription.value.trim(),
    metaKeywords: els.metaKeywords.value.trim(),
    ogImage: els.ogImage.value.trim(),
    canonicalUrl: els.canonicalUrl.value.trim(),
    affiliateUrl: els.affiliateUrl.value.trim(),
    affiliateLabel: els.affiliateLabel.value.trim(),
    affiliateCategory: els.affiliateCategory.value.trim()
  };
}

async function loadAds() {
  ads = await requestJson(`${API_BASE}/api/admin/ads`);
  els.adsTable.innerHTML = ads.length ? "" : `<tr><td colspan="5" class="muted">No ads created yet.</td></tr>`;
  ads.forEach((ad) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><div class="tool-name">${ad.title}</div><div class="tool-slug">${ad.url || "No target URL"}</div></td>
      <td>${ad.position}</td>
      <td><span class="badge ${ad.active ? "" : "inactive"}">${ad.active ? "active" : "inactive"}</span></td>
      <td>${number(ad.clicks)}</td>
      <td><div class="row-actions"><button class="small-btn" data-action="edit-ad" data-id="${ad._id}">Edit</button><button class="danger-btn" data-action="delete-ad" data-id="${ad._id}">Delete</button></div></td>
    `;
    els.adsTable.appendChild(row);
  });
}

function resetAdForm() {
  els.adForm.reset();
  els.adId.value = "";
  els.adActive.checked = true;
  els.adFormTitle.textContent = "Create Ad";
}

function fillAdForm(ad) {
  els.adId.value = ad._id;
  els.adTitle.value = ad.title || "";
  els.adImage.value = ad.image || "";
  els.adUrl.value = ad.url || "";
  els.adPosition.value = ad.position || "top";
  els.adActive.checked = ad.active !== false;
  els.adFormTitle.textContent = `Edit ${ad.title}`;
}

async function saveAd(event) {
  event.preventDefault();
  const payload = {
    title: els.adTitle.value.trim(),
    image: els.adImage.value.trim(),
    url: els.adUrl.value.trim(),
    position: els.adPosition.value,
    active: els.adActive.checked
  };
  const id = els.adId.value;
  await requestJson(`${API_BASE}/api/admin/ads${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });
  resetAdForm();
  await refreshDashboard();
}

async function loadBlog() {
  blogPosts = await requestJson(`${API_BASE}/api/admin/blog`);
  els.blogTable.innerHTML = blogPosts.length ? "" : `<tr><td colspan="4" class="muted">No blog posts yet.</td></tr>`;
  blogPosts.forEach((post) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${post.title}</td>
      <td><span class="badge ${post.status === "draft" ? "inactive" : ""}">${post.status}</span></td>
      <td>${post.slug}</td>
      <td><div class="row-actions"><button class="small-btn" data-action="edit-post" data-id="${post._id}">Edit</button><button class="small-btn" data-action="view-post" data-slug="${post.slug}">View</button><button class="danger-btn" data-action="delete-post" data-id="${post._id}">Delete</button></div></td>
    `;
    els.blogTable.appendChild(row);
  });
}

function resetBlogForm() {
  els.blogForm.reset();
  els.blogId.value = "";
  els.blogStatus.value = "draft";
  els.blogFormTitle.textContent = "Create Article";
}

function fillBlogForm(post) {
  els.blogId.value = post._id;
  els.blogTitle.value = post.title || "";
  els.blogSlug.value = post.slug || "";
  els.blogStatus.value = post.status || "draft";
  els.blogExcerpt.value = post.excerpt || "";
  els.blogContent.value = post.content || "";
  els.blogMetaTitle.value = post.metaTitle || "";
  els.blogMetaDescription.value = post.metaDescription || "";
  els.blogFormTitle.textContent = `Edit ${post.title}`;
}

async function saveBlog(event) {
  event.preventDefault();
  const payload = {
    title: els.blogTitle.value.trim(),
    slug: slugify(els.blogSlug.value || els.blogTitle.value),
    status: els.blogStatus.value,
    excerpt: els.blogExcerpt.value.trim(),
    content: els.blogContent.value.trim(),
    metaTitle: els.blogMetaTitle.value.trim(),
    metaDescription: els.blogMetaDescription.value.trim()
  };
  const id = els.blogId.value;
  await requestJson(`${API_BASE}/api/admin/blog${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });
  resetBlogForm();
  await refreshDashboard();
}

async function loadSubscribers() {
  const subscribers = await requestJson(`${API_BASE}/api/admin/subscribers`);
  renderSimpleList(els.subscribersList, subscribers.map((item) => ({
    label: item.email,
    sub: item.status,
    value: new Date(item.createdAt).toLocaleDateString()
  })), "No subscribers yet.");
}

async function loadContacts() {
  const contacts = await requestJson(`${API_BASE}/api/admin/contacts?status=${encodeURIComponent(els.contactStatusFilter.value)}`);
  els.contactList.innerHTML = "";
  if (!contacts.length) {
    els.contactList.innerHTML = `<p class="muted">No contact messages found.</p>`;
    return;
  }
  contacts.forEach((contact) => {
    const item = document.createElement("div");
    item.className = "rank-item message-item";
    item.innerHTML = `
      <div>
        <strong>${contact.name || "Unknown"} <span class="badge ${contact.status === "unread" ? "warning" : contact.status === "archived" ? "inactive" : ""}">${contact.status}</span></strong>
        <span class="muted">${contact.email || ""} / ${new Date(contact.createdAt).toLocaleString()}</span>
        <p>${contact.message || ""}</p>
      </div>
      <div class="row-actions">
        <button class="small-btn" data-action="contact-status" data-id="${contact._id}" data-status="read">Read</button>
        <button class="secondary-btn" data-action="contact-status" data-id="${contact._id}" data-status="archived">Archive</button>
      </div>
    `;
    els.contactList.appendChild(item);
  });
}

async function loadErrors() {
  const errors = await requestJson(`${API_BASE}/api/admin/errors`);
  renderSimpleList(els.errorsList, errors.map((err) => ({
    label: err.message || err.type,
    sub: `${err.path || ""} ${new Date(err.createdAt).toLocaleString()}`,
    value: err.type
  })), "No errors logged.");
}

async function handleAdsClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const ad = ads.find((item) => item._id === button.dataset.id);
  if (button.dataset.action === "edit-ad" && ad) fillAdForm(ad);
  if (button.dataset.action === "delete-ad" && ad && window.confirm(`Delete "${ad.title}"?`)) {
    await requestJson(`${API_BASE}/api/admin/ads/${ad._id}`, { method: "DELETE" });
    await refreshDashboard();
  }
}

async function handleBlogClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const post = blogPosts.find((item) => item._id === button.dataset.id);
  if (button.dataset.action === "edit-post" && post) fillBlogForm(post);
  if (button.dataset.action === "view-post") window.open(`blog/${encodeURIComponent(button.dataset.slug)}`, "_blank");
  if (button.dataset.action === "delete-post" && post && window.confirm(`Delete "${post.title}"?`)) {
    await requestJson(`${API_BASE}/api/admin/blog/${post._id}`, { method: "DELETE" });
    await refreshDashboard();
  }
}

async function handleContactClick(event) {
  const button = event.target.closest("button");
  if (!button || button.dataset.action !== "contact-status") return;
  await requestJson(`${API_BASE}/api/admin/contacts/${button.dataset.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: button.dataset.status })
  });
  await refreshDashboard();
}

async function handlePlansClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const plan = businessData?.plans.find((item) => item._id === button.dataset.id);
  if (button.dataset.action === "edit-plan" && plan) fillPlanForm(plan);
  if (button.dataset.action === "delete-plan" && plan && window.confirm(`Delete "${plan.name}"?`)) {
    await requestJson(`${API_BASE}/api/admin/business/plans/${plan._id}`, { method: "DELETE" });
    await refreshDashboard();
  }
}

async function handlePaymentsClick(event) {
  const button = event.target.closest("button");
  if (!button || button.dataset.action !== "payment-status") return;
  await requestJson(`${API_BASE}/api/admin/business/payments/${button.dataset.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: button.dataset.status })
  });
  await refreshDashboard();
}

async function handleBusinessStatusClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const actionMap = {
    "referral-status": "referrals",
    "ad-lead-status": "ad-leads",
    "api-subscription-status": "api-subscriptions"
  };
  const endpoint = actionMap[button.dataset.action];
  if (!endpoint) return;
  await requestJson(`${API_BASE}/api/admin/business/${endpoint}/${button.dataset.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: button.dataset.status })
  });
  await refreshDashboard();
}

async function saveTool(event) {
  event.preventDefault();
  const payload = readForm();
  const id = els.toolId.value;

  try {
    if (id) {
      await requestJson(`${API_BASE}/api/admin/tools/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setMessage("Tool updated successfully.");
    } else {
      await requestJson(`${API_BASE}/api/admin/tools`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      resetForm();
      setMessage("Tool created successfully.");
    }

    await refreshDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function handleTableClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const tool = tools.find((item) => item._id === id);

  if (action === "edit" && tool) {
    fillForm(tool);
    return;
  }

  if (action === "view") {
    window.open(`tool.html?slug=${encodeURIComponent(button.dataset.slug)}`, "_blank");
    return;
  }

  if (action === "toggle" && tool) {
    const nextStatus = tool.status === "active" ? "inactive" : "active";
    await requestJson(`${API_BASE}/api/admin/tools/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    setMessage(`Tool ${nextStatus === "active" ? "activated" : "deactivated"}.`);
    await refreshDashboard();
    return;
  }

  if (action === "delete" && tool) {
    if (!window.confirm(`Delete "${tool.name}" permanently?`)) return;
    await requestJson(`${API_BASE}/api/admin/tools/${id}`, { method: "DELETE" });
    resetForm();
    setMessage("Tool deleted.");
    await refreshDashboard();
  }
}

function activateSection(sectionName) {
  els.menuButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionName);
  });
  els.sections.forEach((section) => {
    section.classList.toggle("active", section.id === `${sectionName}Section`);
  });
}

async function resetMetrics() {
  if (!window.confirm("Reset all tool views and affiliate clicks to zero?")) return;
  await requestJson(`${API_BASE}/api/admin/metrics/reset`, { method: "POST", body: "{}" });
  await refreshDashboard();
}

async function refreshDashboard() {
  await loadStats();
  await loadTools();
  await loadAnalytics();
  await loadBusiness();
  await loadMonetization();
  await loadAds();
  await loadBlog();
  await loadSubscribers();
  await loadContacts();
  await loadErrors();
}

els.loginForm.addEventListener("submit", login);
els.logoutBtn.addEventListener("click", logout);
els.refreshAllBtn.addEventListener("click", () => refreshDashboard().catch((err) => setMessage(err.message, true)));
els.menuButtons.forEach((button) => {
  button.addEventListener("click", () => activateSection(button.dataset.section));
});
els.name.addEventListener("input", () => {
  if (!els.toolId.value) els.slug.value = slugify(els.name.value);
});
els.searchInput.addEventListener("input", () => loadTools().catch((err) => setMessage(err.message, true)));
els.statusFilter.addEventListener("change", () => loadTools().catch((err) => setMessage(err.message, true)));
els.categoryFilter.addEventListener("change", () => loadTools().catch((err) => setMessage(err.message, true)));
els.refreshBtn.addEventListener("click", () => refreshDashboard().catch((err) => setMessage(err.message, true)));
els.newToolBtn.addEventListener("click", resetForm);
els.resetBtn.addEventListener("click", resetForm);
els.resetMetricsBtn.addEventListener("click", () => resetMetrics().catch((err) => setMessage(err.message, true)));
els.form.addEventListener("submit", saveTool);
els.adForm.addEventListener("submit", (event) => saveAd(event).catch((err) => setMessage(err.message, true)));
els.resetAdBtn.addEventListener("click", resetAdForm);
els.adsTable.addEventListener("click", (event) => handleAdsClick(event).catch((err) => setMessage(err.message, true)));
els.blogForm.addEventListener("submit", (event) => saveBlog(event).catch((err) => setMessage(err.message, true)));
els.resetBlogBtn.addEventListener("click", resetBlogForm);
els.blogTitle.addEventListener("input", () => {
  if (!els.blogId.value) els.blogSlug.value = slugify(els.blogTitle.value);
});
els.blogTable.addEventListener("click", (event) => handleBlogClick(event).catch((err) => setMessage(err.message, true)));
els.contactStatusFilter.addEventListener("change", () => loadContacts().catch((err) => setMessage(err.message, true)));
els.contactList.addEventListener("click", (event) => handleContactClick(event).catch((err) => setMessage(err.message, true)));
els.planForm.addEventListener("submit", (event) => savePlan(event).catch((err) => setMessage(err.message, true)));
els.planName.addEventListener("input", () => {
  if (!els.planId.value) els.planSlug.value = slugify(els.planName.value);
});
els.resetPlanBtn.addEventListener("click", resetPlanForm);
els.plansTable.addEventListener("click", (event) => handlePlansClick(event).catch((err) => setMessage(err.message, true)));
els.paymentForm.addEventListener("submit", (event) => savePayment(event).catch((err) => setMessage(err.message, true)));
els.paymentsTable.addEventListener("click", (event) => handlePaymentsClick(event).catch((err) => setMessage(err.message, true)));
els.referralsList.addEventListener("click", (event) => handleBusinessStatusClick(event).catch((err) => setMessage(err.message, true)));
els.directAdLeadsList.addEventListener("click", (event) => handleBusinessStatusClick(event).catch((err) => setMessage(err.message, true)));
els.apiSubscriptionsList.addEventListener("click", (event) => handleBusinessStatusClick(event).catch((err) => setMessage(err.message, true)));
els.businessSettingsForm.addEventListener("submit", (event) => saveBusinessSettings(event).catch((err) => setMessage(err.message, true)));
els.toolsTable.addEventListener("click", (event) => {
  handleTableClick(event).catch((err) => setMessage(err.message, true));
});

if (adminToken) {
  showAdmin();
  refreshDashboard().catch(() => showLogin());
} else {
  showLogin();
}
