const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;

const TOKEN_KEY = "smartToolsAdminToken";

const $ = (id) => document.getElementById(id);
const number = (value) => Number(value || 0).toLocaleString();
const text = (value) => String(value || "").trim();

const state = {
  stats: {},
  tools: [],
  categories: [],
  ads: [],
  affiliates: [],
  businessSettings: {},
  blogPosts: [],
  subscribers: [],
  contacts: [],
  plans: [],
  payments: [],
  revenue: {},
  apiSubscriptions: [],
  trafficChart: null,
  categoryChart: null,
  loading: false,
  editingToolId: null,
  editingAffiliateId: null,
  editingAdId: null,
  editingBlogPostId: null,
  editingPlanId: null,
  editingSubscriptionId: null
};

const els = {
  loginScreen: $("loginScreen"),
  loginForm: $("loginForm"),
  adminPassword: $("adminPassword"),
  loginMessage: $("loginMessage"),
  adminApp: $("adminApp"),
  dashboardStatus: $("dashboardStatus"),
  logoutBtn: $("logoutBtn"),
  refreshAllBtn: $("refreshAllBtn"),
  menuButtons: document.querySelectorAll(".menu-btn"),
  sections: document.querySelectorAll(".admin-section"),
  toolsTable: $("toolsTable"),
  toolsSummary: $("toolsSummary"),
  searchInput: $("searchInput"),
  statusFilter: $("statusFilter"),
  categoryFilter: $("categoryFilter"),
  newToolBtn: $("newToolBtn"),
  toolForm: $("toolForm"),
  resetBtn: $("resetBtn"),
  message: $("message"),
  formTitle: $("formTitle"),
  formHint: $("formHint"),
  affiliateForm: $("affiliateForm"),
  affiliateTable: $("affiliateTable"),
  adForm: $("adForm"),
  adTable: $("adTable"),
  businessSettingsForm: $("businessSettingsForm"),
  blogPostForm: $("blogPostForm"),
  blogPostTable: $("blogPostTable"),
  subscriberTable: $("subscriberTable"),
  contactTable: $("contactTable"),
  planForm: $("planForm"),
  planTable: $("planTable"),
  paymentTable: $("paymentTable"),
  apiSubscriptionForm: $("apiSubscriptionForm"),
  apiSubscriptionTable: $("apiSubscriptionTable"),
  apiStatus: $("apiStatus"),
  sessionStatus: $("sessionStatus"),
  lastRefresh: $("lastRefresh"),
  apiBaseLabel: $("apiBaseLabel")
};

class ApiClient {
constructor(baseUrl) {
this.baseUrl = baseUrl;
this.csrfToken = "";
}

get token() {
return localStorage.getItem(TOKEN_KEY) || "";
}

set token(value) {
localStorage.setItem(TOKEN_KEY, value);
}

clearToken() {
localStorage.removeItem(TOKEN_KEY);
}

async getCsrfToken() {
  if (typeof window.getCsrfToken === "function") {
    this.csrfToken = await window.getCsrfToken();
    return this.csrfToken;
  }
  throw new Error("Global CSRF helper is not loaded.");
}

async headers(method = "GET") {
const headers = { "Content-Type": "application/json" };

if (this.token) {
headers["x-admin-token"] = this.token;
}

if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
if (!this.csrfToken) {
await this.getCsrfToken();
}

headers["X-CSRF-Token"] = this.csrfToken;
}

return headers;
}

async request(path, options = {}) {
const method = (options.method || "GET").toUpperCase();

const requestUrl = `${this.baseUrl}${path}`;
const res = await (typeof window.apiFetch === "function" ? window.apiFetch : fetch)(
  requestUrl,
  {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(await this.headers(method)),
      ...(options.headers || {})
    }
  }
);

const data = await res.json().catch(() => ({}));

if (res.status === 401) {
this.clearToken();
showLogin();
throw new Error(data.message || "Admin login required.");
}

if (!res.ok) {
throw new Error(data.message || `Request failed: ${res.status}`);
}

if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
this.csrfToken = "";
}

return data;
}

get(path) {
return this.request(path);
}

post(path, body) {
return this.request(path, {
method: "POST",
body: JSON.stringify(body)
});
}

put(path, body) {
return this.request(path, {
method: "PUT",
body: JSON.stringify(body)
});
}

delete(path) {
return this.request(path, {
method: "DELETE"
});
}
}
const api = new ApiClient(API_BASE);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setMessage(message, isError = false) {
  if (!els.message) return;
  els.message.textContent = message;
  els.message.classList.toggle("error", isError);
  els.message.classList.toggle("success", !isError && Boolean(message));
}

function showAdmin() {
  els.loginScreen?.classList.add("hidden");
  els.adminApp?.classList.remove("hidden");
  setText("sessionStatus", "Active");
}

function showLogin() {
  els.adminApp?.classList.add("hidden");
  els.loginScreen?.classList.remove("hidden");
  setText("sessionStatus", "Signed out");
}

function showSection(name) {
  els.menuButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === name);
  });
  els.sections.forEach((section) => {
    section.classList.toggle("active", section.id === `${name}Section`);
  });
}

async function login(event) {
  event.preventDefault();
  els.loginMessage.textContent = "";

  try {
    const data = await api.post("/api/admin/login", {
      password: els.adminPassword.value
    });
    api.token = data.token;
    els.adminPassword.value = "";
    showAdmin();
    await loadDashboard();
  } catch (err) {
    els.loginMessage.textContent = err.message;
  }
}

async function logout() {
  if (api.token) {
    await api.request("/api/admin/logout", { method: "POST" }).catch(() => {});
  }
  api.clearToken();
  showLogin();
}

async function loadDashboard() {
  if (state.loading) return;
  state.loading = true;
  setText("dashboardStatus", "Refreshing live data...");

  try {
    const [stats, tools, ads, affiliates, businessSettings, blogPosts, subscribers, contacts, plans, payments, apiSubscriptions, revenue] = await Promise.all([
      api.get("/api/admin/stats"),
      api.get("/api/admin/tools"),
      api.get("/api/admin/ads"),
      api.get("/api/admin/affiliates"),
      api.get("/api/admin/business-settings"),
      api.get("/api/admin/blog-posts"),
      api.get("/api/admin/subscribers"),
      api.get("/api/admin/contacts"),
      api.get("/api/admin/plans"),
      api.get("/api/admin/payments"),
      api.get("/api/admin/api-subscriptions"),
      api.get("/api/admin/revenue-summary")
    ]);

    state.stats = stats || {};
    state.tools = Array.isArray(tools) ? tools : [];
    state.ads = Array.isArray(ads) ? ads : [];
    state.affiliates = Array.isArray(affiliates) ? affiliates : [];
    state.businessSettings = businessSettings || {};
    state.blogPosts = Array.isArray(blogPosts) ? blogPosts : [];
    state.subscribers = Array.isArray(subscribers) ? subscribers : [];
    state.contacts = Array.isArray(contacts) ? contacts : [];
    state.plans = Array.isArray(plans) ? plans : [];
    state.payments = Array.isArray(payments) ? payments : [];
    state.apiSubscriptions = Array.isArray(apiSubscriptions) ? apiSubscriptions : [];
    state.revenue = revenue || {};
    state.categories = [...new Set(state.tools.map((tool) => tool.category).filter(Boolean))].sort();

    renderStats();
    setText("totalRevenue", `USD ${Number(state.revenue.totalRevenue || 0).toFixed(2)}`);
    setText("monthlyRevenue", `USD ${Number(state.revenue.monthlyRevenue || 0).toFixed(2)}`);
    setText("paidSubscribers", number(state.revenue.paidSubscribers));
    setText("paymentExceptions", `${number(state.revenue.failedPayments)} / ${number(state.revenue.refunds)}`);
    renderCategoryFilter();
    renderTools();
    renderAffiliates();
    renderAds();
    renderBusinessSettings();
    renderBlogPosts();
    renderSubscribers();
    renderContacts();
    renderPlans();
    renderPayments();
    renderApiSubscriptions();
    renderLists();
    renderCharts();
    renderSystem();

    setText("dashboardStatus", "Connected to Smart Tools Platform");
    setText("lastRefresh", new Date().toLocaleString());
    setText("apiStatus", "Connected");
    $("apiStatus")?.classList.remove("inactive");
  } catch (err) {
    setText("dashboardStatus", err.message);
    setText("apiStatus", "Needs login");
    $("apiStatus")?.classList.add("inactive");
    if (err.message !== "Admin login required.") console.error(err);
  } finally {
    state.loading = false;
  }
}

function renderStats() {
  const stats = state.stats || {};
  const views = Number(stats.views || 0);
  const clicks = Number(stats.affiliateClicks || 0);
  const ctr = views ? ((clicks / views) * 100).toFixed(1) : "0.0";
  const downloads = stats.downloads || {};

  setText("totalTools", number(stats.totalTools));
  setText("activeTools", number(stats.activeTools));
  setText("inactiveTools", number(stats.inactiveTools));
  setText("viewCount", number(views));
  setText("affiliateClickCount", number(clicks));
  setText("affiliateCtr", `${ctr}%`);
  setText("downloadCount", number(downloads.downloads || downloads.files || 0));
  setText("visitorsToday", number(stats.visitorsToday));
  setText("visitorsMonth", number(stats.visitorsMonth));
  setText("adClickCount", number(stats.adClicks));
  setText("subscriberCount", number(stats.subscribers));
  setText("unreadContactCount", number(stats.unreadContacts));

  setText("moneyAffiliateClicks", number(clicks));
  setText("moneyAdClicks", number(stats.adClicks));
  setText("moneyCtr", `${ctr}%`);
  setText("moneyDownloads", number(downloads.downloads || downloads.files || 0));

  setText("businessSubscribers", number(stats.subscribers));
  setText("businessContacts", number(stats.unreadContacts));
  setText("businessVisitors", number(stats.visitorsMonth));
  setText("businessTools", number(stats.activeTools));

  if (els.apiStatus) els.apiStatus.textContent = "Connected";
  if (els.sessionStatus) els.sessionStatus.textContent = api.token ? "Active" : "Signed out";
  if (els.lastRefresh) els.lastRefresh.textContent = new Date().toLocaleString();
}

function renderSimpleList(containerId, rows, emptyText) {
  const container = $(containerId);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
    return;
  }

  container.innerHTML = rows.map((row) => `
    <div class="rank-item">
      <div>
        <strong>${escapeHtml(row.label)}</strong>
        <span class="muted">${escapeHtml(row.sub || "")}</span>
      </div>
      <div class="rank-metrics">${escapeHtml(row.value)}</div>
    </div>
  `).join("");
}

function renderLists() {
  const topViewed = (state.stats.topViewed || state.tools)
    .slice()
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
    .slice(0, 8)
    .map((tool) => ({
      label: tool.name || tool.slug || "Tool",
      sub: tool.category || "",
      value: `${number(tool.views)} views`
    }));

  const topAffiliate = (state.stats.topAffiliate || state.tools)
    .slice()
    .sort((a, b) => Number(b.affiliateClicks || 0) - Number(a.affiliateClicks || 0))
    .slice(0, 8)
    .map((tool) => ({
      label: tool.name || tool.slug || "Tool",
      sub: tool.affiliateLabel || tool.category || "",
      value: `${number(tool.affiliateClicks)} clicks`
    }));

  const categoryRows = (state.stats.categories || state.categories.map((category) => ({
    _id: category,
    count: state.tools.filter((tool) => tool.category === category).length
  }))).map((item) => ({
    label: item._id || "Uncategorized",
    value: `${number(item.count)} tools`
  }));

  renderSimpleList("topViewedList", topViewed, "No tool views yet.");
  renderSimpleList("topAffiliateList", topAffiliate, "No affiliate clicks yet.");
  renderSimpleList("monetizationList", topAffiliate, "No monetization clicks yet.");
  renderSimpleList("categoryList", categoryRows, "No categories yet.");

  if (els.apiBaseLabel) els.apiBaseLabel.textContent = API_BASE;
}

function renderCategoryFilter() {
  if (!els.categoryFilter) return;
  const selected = els.categoryFilter.value;
  els.categoryFilter.innerHTML = '<option value="">All categories</option>' +
    state.categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  els.categoryFilter.value = selected;
}

function filteredTools() {
  const query = text(els.searchInput?.value).toLowerCase();
  const status = els.statusFilter?.value || "";
  const category = els.categoryFilter?.value || "";

  return state.tools.filter((tool) => {
    const haystack = `${tool.name || ""} ${tool.slug || ""} ${tool.category || ""} ${tool.description || ""}`.toLowerCase();
    return (!query || haystack.includes(query)) &&
      (!status || tool.status === status) &&
      (!category || tool.category === category);
  });
}

function renderTools() {
  const tools = filteredTools();
  setText("toolsSummary", `${number(tools.length)} of ${number(state.tools.length)} tools shown`);

  if (!els.toolsTable) return;
  if (!tools.length) {
    els.toolsTable.innerHTML = '<tr><td colspan="6" class="empty-state">No tools match the current filters.</td></tr>';
    return;
  }

  els.toolsTable.innerHTML = tools.map((tool) => `
    <tr>
      <td>
        <strong>${escapeHtml(tool.name || "-")}</strong>
        <span class="muted">${escapeHtml(tool.slug || "")}</span>
      </td>
      <td>${escapeHtml(tool.category || "-")}</td>
      <td><span class="badge ${tool.status === "inactive" ? "inactive" : ""}">${escapeHtml(tool.status || "active")}</span></td>
      <td>${number(tool.views)}</td>
      <td>${number(tool.affiliateClicks)}</td>
      <td class="actions-cell">
        <button class="small-btn secondary-btn edit-tool" type="button" data-id="${escapeHtml(tool._id)}">Edit</button>
        <a class="small-btn as-link" href="/tools/${encodeURIComponent(tool.slug || "")}" target="_blank" rel="noopener">Open</a>
        <button class="danger-btn small-btn delete-tool" type="button" data-id="${escapeHtml(tool._id)}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function updateToolFormTitle() {
  if (els.formTitle) els.formTitle.textContent = state.editingToolId ? "Edit Tool" : "Create Tool";
  if (els.formHint) els.formHint.textContent = state.editingToolId ? "Update the selected tool" : "Add a tool to the public Smart Tools website";
}

function populateToolForm(tool) {
  if (!tool) return;
  state.editingToolId = tool._id;
  $("name") && ($("name").value = tool.name || "");
  $("slug") && ($("slug").value = tool.slug || "");
  $("category") && ($("category").value = tool.category || "");
  $("status") && ($("status").value = tool.status || "active");
  $("description") && ($("description").value = tool.description || "");
  $("affiliateLabel") && ($("affiliateLabel").value = tool.affiliateLabel || "");
  $("affiliateUrl") && ($("affiliateUrl").value = tool.affiliateUrl || "");
  $("affiliateCategory") && ($("affiliateCategory").value = tool.affiliateCategory || "");
  $("metaTitle") && ($("metaTitle").value = tool.metaTitle || "");
  $("metaDescription") && ($("metaDescription").value = tool.metaDescription || "");
  $("metaKeywords") && ($("metaKeywords").value = tool.metaKeywords || "");
  $("ogImage") && ($("ogImage").value = tool.ogImage || "");
  $("canonicalUrl") && ($("canonicalUrl").value = tool.canonicalUrl || "");
  updateToolFormTitle();
  showSection("tools");
  $("name")?.focus();
}

function toolFormData() {
  const data = {
    name: text($("name")?.value),
    slug: slugify($("slug")?.value || $("name")?.value),
    category: text($("category")?.value),
    status: $("status")?.value || "active",
    description: text($("description")?.value),
    affiliateLabel: text($("affiliateLabel")?.value),
    affiliateUrl: text($("affiliateUrl")?.value),
    affiliateCategory: text($("affiliateCategory")?.value),
    metaTitle: text($("metaTitle")?.value),
    metaDescription: text($("metaDescription")?.value),
    metaKeywords: text($("metaKeywords")?.value),
    ogImage: text($("ogImage")?.value),
    canonicalUrl: text($("canonicalUrl")?.value)
  };
  if (!data.metaTitle) data.metaTitle = data.name;
  if (!data.canonicalUrl && data.slug) data.canonicalUrl = `${window.location.origin}/tools/${data.slug}`;
  return data;
}

async function saveTool(event) {
  event.preventDefault();
  setMessage("");

  try {
    const data = toolFormData();
    if (!data.name || !data.slug || !data.category) {
      setMessage("Name, slug, and category are required.", true);
      return;
    }
    if (state.editingToolId) {
      await api.put(`/api/admin/tools/${encodeURIComponent(state.editingToolId)}`, data);
    } else {
      await api.post("/api/admin/tools", data);
    }
    resetToolForm();
    setMessage(state.editingToolId ? "Tool updated." : "Tool saved.");
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

function resetToolForm() {
  state.editingToolId = null;
  els.toolForm?.reset();
  setMessage("");
  updateToolFormTitle();
}

async function deleteTool(button) {
  const id = button.dataset.id;
  if (!id) return;
  const confirmed = window.confirm("Delete this tool from Smart Tools Hub?");
  if (!confirmed) return;

  try {
    await api.delete(`/api/admin/tools/${encodeURIComponent(id)}`);
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

function renderAffiliates() {
  if (!els.affiliateTable) return;
  if (!state.affiliates.length) {
    els.affiliateTable.innerHTML = '<tr><td colspan="5" class="empty-state">No affiliates yet.</td></tr>';
    return;
  }

  els.affiliateTable.innerHTML = state.affiliates.map((affiliate) => `
    <tr>
      <td>${escapeHtml(affiliate.key || "-")}</td>
      <td>${escapeHtml(affiliate.name || "-")}</td>
      <td><span class="badge ${affiliate.active === false ? "inactive" : ""}">${escapeHtml(affiliate.active === false ? "Inactive" : "Active")}</span></td>
      <td>${number(affiliate.clicks)}</td>
      <td class="actions-cell">
        <button class="small-btn secondary-btn edit-affiliate" type="button" data-id="${escapeHtml(affiliate._id)}">Edit</button>
        <button class="danger-btn small-btn delete-affiliate" type="button" data-id="${escapeHtml(affiliate._id)}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function affiliateFormData() {
  return {
    key: text($("affiliateKey")?.value),
    name: text($("affiliateName")?.value),
    base_url: text($("affiliateBaseUrl")?.value),
    affiliate_url: text($("affiliateUrl")?.value),
    network: text($("affiliateNetwork")?.value),
    active: $("affiliateActive")?.value === "true"
  };
}

async function saveAffiliate(event) {
  event.preventDefault();
  try {
    const data = affiliateFormData();
    if (!data.key || !data.base_url) {
      setMessage("Affiliate key and base URL are required.", true);
      return;
    }
    if (state.editingAffiliateId) {
      await api.put(`/api/admin/affiliates/${encodeURIComponent(state.editingAffiliateId)}`, data);
    } else {
      await api.post("/api/admin/affiliates", data);
    }
    els.affiliateForm?.reset();
    state.editingAffiliateId = null;
    setMessage("Affiliate saved.");
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

function renderAds() {
  if (!els.adTable) return;
  if (!state.ads.length) {
    els.adTable.innerHTML = '<tr><td colspan="5" class="empty-state">No ads yet.</td></tr>';
    return;
  }

  els.adTable.innerHTML = state.ads.map((ad) => `
    <tr>
      <td>${escapeHtml(ad.title || "-")}</td>
      <td>${escapeHtml(ad.position || "-")}</td>
      <td><span class="badge ${ad.active === false ? "inactive" : ""}">${escapeHtml(ad.active === false ? "Inactive" : "Active")}</span></td>
      <td>${number(ad.clicks)}</td>
      <td class="actions-cell">
        <button class="small-btn secondary-btn edit-ad" type="button" data-id="${escapeHtml(ad._id)}">Edit</button>
        <button class="danger-btn small-btn delete-ad" type="button" data-id="${escapeHtml(ad._id)}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function adFormData() {
  return {
    title: text($("adTitle")?.value),
    subtitle: text($("adSubtitle")?.value),
    location: text($("adLocation")?.value),
    cta: text($("adCta")?.value),
    image: text($("adImage")?.value),
    url: text($("adUrl")?.value),
    position: $("adPosition")?.value || "top",
    active: $("adActive")?.value === "true"
  };
}

async function saveAd(event) {
  event.preventDefault();
  try {
    const data = adFormData();
    if (!data.title) {
      setMessage("Ad title is required.", true);
      return;
    }
    if (state.editingAdId) {
      await api.put(`/api/admin/ads/${encodeURIComponent(state.editingAdId)}`, data);
    } else {
      await api.post("/api/admin/ads", data);
    }
    els.adForm?.reset();
    state.editingAdId = null;
    setMessage("Ad saved.");
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

function renderBusinessSettings() {
  if (!els.businessSettingsForm) return;
  const settings = state.businessSettings || {};
  $("brandName") && ($("brandName").value = settings.brandName || "");
  $("logoUrl") && ($("logoUrl").value = settings.logoUrl || "");
  $("paypalAccountEmail") && ($("paypalAccountEmail").value = settings.paypalAccountEmail || "");
  $("paypalUrl") && ($("paypalUrl").value = settings.paypalUrl || "");
  $("adsensePublisherId") && ($("adsensePublisherId").value = settings.adsensePublisherId || "");
  $("propellerAdsCode") && ($("propellerAdsCode").value = settings.propellerAdsCode || "");
  $("adsterraCode") && ($("adsterraCode").value = settings.adsterraCode || "");
  $("facebookLink") && ($("facebookLink").value = (settings.socialLinks && settings.socialLinks.facebook) || "");
  $("linkedinLink") && ($("linkedinLink").value = (settings.socialLinks && settings.socialLinks.linkedin) || "");
  $("youtubeLink") && ($("youtubeLink").value = (settings.socialLinks && settings.socialLinks.youtube) || "");
}

async function saveBusinessSettings(event) {
  event.preventDefault();
  try {
    const data = {
      brandName: text($("brandName")?.value),
      logoUrl: text($("logoUrl")?.value),
      paypalAccountEmail: text($("paypalAccountEmail")?.value),
      paypalUrl: text($("paypalUrl")?.value),
      adsensePublisherId: text($("adsensePublisherId")?.value),
      propellerAdsCode: text($("propellerAdsCode")?.value),
      adsterraCode: text($("adsterraCode")?.value),
      socialLinks: {
        facebook: text($("facebookLink")?.value),
        linkedin: text($("linkedinLink")?.value),
        youtube: text($("youtubeLink")?.value)
      }
    };
    await api.put("/api/admin/business-settings", data);
    setMessage("Business settings saved.");
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

function renderBlogPosts() {
  if (!els.blogPostTable) return;
  if (!state.blogPosts.length) {
    els.blogPostTable.innerHTML = '<tr><td colspan="3" class="empty-state">No blog posts yet.</td></tr>';
    return;
  }

  els.blogPostTable.innerHTML = state.blogPosts.map((post) => `
    <tr>
      <td>${escapeHtml(post.title || "-")}</td>
      <td><span class="badge ${post.status === "published" ? "" : "inactive"}">${escapeHtml(post.status || "draft")}</span></td>
      <td class="actions-cell">
        <button class="small-btn secondary-btn edit-blog-post" type="button" data-id="${escapeHtml(post._id)}">Edit</button>
        <button class="danger-btn small-btn delete-blog-post" type="button" data-id="${escapeHtml(post._id)}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function blogPostFormData() {
  return {
    title: text($("blogTitle")?.value),
    slug: text($("blogSlug")?.value) || slugify($("blogTitle")?.value),
    excerpt: text($("blogExcerpt")?.value),
    content: text($("blogContent")?.value),
    metaTitle: text($("blogMetaTitle")?.value),
    metaDescription: text($("blogMetaDescription")?.value),
    status: $("blogStatus")?.value || "draft"
  };
}

async function saveBlogPost(event) {
  event.preventDefault();
  try {
    const data = blogPostFormData();
    if (!data.title) {
      setMessage("Blog title is required.", true);
      return;
    }
    if (state.editingBlogPostId) {
      await api.put(`/api/admin/blog-posts/${encodeURIComponent(state.editingBlogPostId)}`, data);
    } else {
      await api.post("/api/admin/blog-posts", data);
    }
    els.blogPostForm?.reset();
    state.editingBlogPostId = null;
    setMessage("Blog post saved.");
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

function renderSubscribers() {
  if (!els.subscriberTable) return;
  if (!state.subscribers.length) {
    els.subscriberTable.innerHTML = '<tr><td colspan="3" class="empty-state">No subscribers yet.</td></tr>';
    return;
  }

  els.subscriberTable.innerHTML = state.subscribers.map((subscriber) => `
    <tr>
      <td>${escapeHtml(subscriber.email || "-")}</td>
      <td>${escapeHtml(subscriber.status || "active")}</td>
      <td><button class="danger-btn small-btn delete-subscriber" type="button" data-id="${escapeHtml(subscriber._id)}">Delete</button></td>
    </tr>
  `).join("");
}

function renderContacts() {
  if (!els.contactTable) return;
  if (!state.contacts.length) {
    els.contactTable.innerHTML = '<tr><td colspan="3" class="empty-state">No contacts yet.</td></tr>';
    return;
  }

  els.contactTable.innerHTML = state.contacts.map((contact) => `
    <tr>
      <td>${escapeHtml(contact.name || "-")}</td>
      <td>${escapeHtml(contact.status || "unread")}</td>
      <td class="actions-cell">
        <button class="small-btn secondary-btn mark-contact" type="button" data-id="${escapeHtml(contact._id)}">Mark Read</button>
        <button class="danger-btn small-btn delete-contact" type="button" data-id="${escapeHtml(contact._id)}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function renderCharts() {
  if (!window.Chart) return;

  const trafficCanvas = $("trafficChart");
  if (trafficCanvas) {
    state.trafficChart?.destroy();
    state.trafficChart = new Chart(trafficCanvas, {
      type: "bar",
      data: {
        labels: ["Today", "This Month", "Views", "Affiliate Clicks"],
        datasets: [{
          label: "Traffic",
          data: [
            Number(state.stats.visitorsToday || 0),
            Number(state.stats.visitorsMonth || 0),
            Number(state.stats.views || 0),
            Number(state.stats.affiliateClicks || 0)
          ],
          backgroundColor: ["#1d4ed8", "#10b981", "#f59e0b", "#7c3aed"]
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  const categoryCanvas = $("categoryChart");
  if (categoryCanvas) {
    const categories = (state.stats.categories || []).slice(0, 10);
    state.categoryChart?.destroy();
    state.categoryChart = new Chart(categoryCanvas, {
      type: "doughnut",
      data: {
        labels: categories.map((item) => item._id || "Uncategorized"),
        datasets: [{
          data: categories.map((item) => item.count || 0),
          backgroundColor: ["#1d4ed8", "#10b981", "#f59e0b", "#ef4444", "#7c3aed", "#0891b2", "#84cc16", "#f97316", "#0f766e", "#64748b"]
        }]
      },
      options: { responsive: true }
    });
  }
}

function renderSystem() {
  if (els.apiBaseLabel) els.apiBaseLabel.textContent = API_BASE;
  if (els.apiStatus) els.apiStatus.textContent = api.token ? "Connected" : "Needs login";
  if (els.sessionStatus) els.sessionStatus.textContent = api.token ? "Active" : "Signed out";
  if (els.lastRefresh) els.lastRefresh.textContent = new Date().toLocaleString();
}

function renderPlans() {
  if (!els.planTable) return;
  if (!state.plans?.length) {
    els.planTable.innerHTML = '<tr><td colspan="4" class="empty-state">No plans yet.</td></tr>';
    return;
  }

  els.planTable.innerHTML = state.plans.map((plan) => `
    <tr>
      <td>${escapeHtml(plan.name || "-")}</td>
      <td>${escapeHtml(plan.price != null ? `${plan.currency || "USD"} ${plan.price}` : "0")}</td>
      <td><span class="badge ${plan.active === false ? "inactive" : ""}">${escapeHtml(plan.active === false ? "Inactive" : "Active")}</span></td>
      <td class="actions-cell">
        <button class="small-btn secondary-btn edit-plan" type="button" data-id="${escapeHtml(plan._id)}">Edit</button>
        <button class="danger-btn small-btn delete-plan" type="button" data-id="${escapeHtml(plan._id)}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function renderPayments() {
  if (!els.paymentTable) return;
  if (!state.payments?.length) {
    els.paymentTable.innerHTML = '<tr><td colspan="5" class="empty-state">No payments yet.</td></tr>';
    return;
  }

  els.paymentTable.innerHTML = state.payments.map((payment) => `
    <tr>
      <td>${escapeHtml(payment.customerName || payment.customerEmail || "-")}</td>
      <td>${escapeHtml(payment.planSlug || "-")}</td>
      <td>${escapeHtml(`${payment.currency || "USD"} ${payment.amount || 0}`)}</td>
      <td><span class="badge ${payment.status === "paid" ? "" : payment.status === "failed" ? "inactive" : ""}">${escapeHtml(payment.status || "pending")}</span></td>
      <td class="actions-cell">
        <button class="small-btn secondary-btn cancel-payment" type="button" data-id="${escapeHtml(payment._id)}">Cancel</button>
        <button class="danger-btn small-btn refund-payment" type="button" data-id="${escapeHtml(payment._id)}">Refund</button>
      </td>
    </tr>
  `).join("");
}

function renderApiSubscriptions() {
  if (!els.apiSubscriptionTable) return;
  if (!state.apiSubscriptions?.length) {
    els.apiSubscriptionTable.innerHTML = '<tr><td colspan="5" class="empty-state">No API subscriptions yet.</td></tr>';
    return;
  }

  els.apiSubscriptionTable.innerHTML = state.apiSubscriptions.map((subscription) => `
    <tr>
      <td>${escapeHtml(subscription.ownerName || subscription.ownerEmail || "-")}</td>
      <td>${escapeHtml(subscription.planSlug || "free")}</td>
      <td><span class="badge ${subscription.status === "active" ? "" : "inactive"}">${escapeHtml(subscription.status || "active")}</span></td>
      <td>${escapeHtml(String(subscription.dailyLimit || subscription.apiLimit || 0))}</td>
      <td class="actions-cell">
        <button class="small-btn secondary-btn edit-subscription" type="button" data-id="${escapeHtml(subscription._id)}">Edit</button>
        <button class="danger-btn small-btn delete-subscription" type="button" data-id="${escapeHtml(subscription._id)}">Delete</button>
      </td>
    </tr>
  `).join("");
}

function planFormData() {
  return {
    name: text($("planName")?.value),
    slug: text($("planSlug")?.value) || slugify($("planName")?.value),
    price: Number($("planPrice")?.value || 0),
    currency: text($("planCurrency")?.value) || "USD",
    interval: $("planInterval")?.value || "monthly",
    dailyLimit: Number($("planDailyLimit")?.value || 0),
    apiLimit: Number($("planApiLimit")?.value || 0),
    features: text($("planFeatures")?.value)
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean),
    active: $("planActive")?.value === "true"
  };
}

async function savePlan(event) {
  event.preventDefault();
  try {
    const data = planFormData();
    if (!data.name || !data.slug) {
      setMessage("Plan name and slug are required.", true);
      return;
    }
    if (state.editingPlanId) {
      await api.put(`/api/admin/plans/${encodeURIComponent(state.editingPlanId)}`, data);
    } else {
      await api.post("/api/admin/plans", data);
    }
    els.planForm?.reset();
    state.editingPlanId = null;
    setMessage("Plan saved.");
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

function subscriptionFormData() {
  return {
    ownerName: text($("subscriptionOwnerName")?.value),
    ownerEmail: text($("subscriptionOwnerEmail")?.value),
    planSlug: text($("subscriptionPlanSlug")?.value) || "free",
    dailyLimit: Number($("subscriptionDailyLimit")?.value || 0),
    status: $("subscriptionStatus")?.value || "active",
    apiKey: text($("subscriptionApiKey")?.value)
  };
}

async function saveApiSubscription(event) {
  event.preventDefault();
  try {
    const data = subscriptionFormData();
    if (!data.ownerEmail) {
      setMessage("Owner email is required.", true);
      return;
    }
    if (state.editingSubscriptionId) {
      await api.put(`/api/admin/api-subscriptions/${encodeURIComponent(state.editingSubscriptionId)}`, data);
    } else {
      await api.post("/api/admin/api-subscriptions", data);
    }
    els.apiSubscriptionForm?.reset();
    state.editingSubscriptionId = null;
    setMessage("API subscription saved.");
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function deletePlan(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.delete(`/api/admin/plans/${encodeURIComponent(id)}`);
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function cancelPayment(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.post(`/api/admin/payments/${encodeURIComponent(id)}/cancel`, {});
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function refundPayment(button) {
  const id = button.dataset.id;
  if (!id || !window.confirm("Refund this payment through Stripe?")) return;
  try {
    await api.post(`/api/admin/payments/${encodeURIComponent(id)}/refund`, {});
    await loadDashboard();
  } catch (err) { setMessage(err.message, true); }
}

async function deleteApiSubscription(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.delete(`/api/admin/api-subscriptions/${encodeURIComponent(id)}`);
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function deleteAffiliate(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.delete(`/api/admin/affiliates/${encodeURIComponent(id)}`);
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function deleteAd(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.delete(`/api/admin/ads/${encodeURIComponent(id)}`);
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function deleteBlogPost(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.delete(`/api/admin/blog-posts/${encodeURIComponent(id)}`);
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function deleteSubscriber(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.delete(`/api/admin/subscribers/${encodeURIComponent(id)}`);
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function markContactRead(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.put(`/api/admin/contacts/${encodeURIComponent(id)}`, { status: "read" });
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

async function deleteContact(button) {
  const id = button.dataset.id;
  if (!id) return;
  try {
    await api.delete(`/api/admin/contacts/${encodeURIComponent(id)}`);
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

document.addEventListener("click", (event) => {
  const menuButton = event.target.closest(".menu-btn");
  if (menuButton) showSection(menuButton.dataset.section);

  const editToolButton = event.target.closest(".edit-tool");
  if (editToolButton) {
    const tool = state.tools.find((item) => item._id === editToolButton.dataset.id);
    if (tool) populateToolForm(tool);
    return;
  }

  const deleteToolButton = event.target.closest(".delete-tool");
  if (deleteToolButton) {
    deleteTool(deleteToolButton);
    return;
  }

  const editAffiliateButton = event.target.closest(".edit-affiliate");
  if (editAffiliateButton) {
    const affiliate = state.affiliates.find((item) => item._id === editAffiliateButton.dataset.id);
    if (affiliate) {
      state.editingAffiliateId = affiliate._id;
      $("affiliateKey") && ($("affiliateKey").value = affiliate.key || "");
      $("affiliateName") && ($("affiliateName").value = affiliate.name || "");
      $("affiliateBaseUrl") && ($("affiliateBaseUrl").value = affiliate.base_url || "");
      $("affiliateUrl") && ($("affiliateUrl").value = affiliate.affiliate_url || "");
      $("affiliateNetwork") && ($("affiliateNetwork").value = affiliate.network || "");
      $("affiliateActive") && ($("affiliateActive").value = affiliate.active === false ? "false" : "true");
      showSection("monetization");
    }
    return;
  }

  const deleteAffiliateButton = event.target.closest(".delete-affiliate");
  if (deleteAffiliateButton) {
    deleteAffiliate(deleteAffiliateButton);
    return;
  }

  const editPlanButton = event.target.closest(".edit-plan");
  if (editPlanButton) {
    const plan = state.plans?.find((item) => item._id === editPlanButton.dataset.id);
    if (plan) {
      state.editingPlanId = plan._id;
      $("planName") && ($("planName").value = plan.name || "");
      $("planSlug") && ($("planSlug").value = plan.slug || "");
      $("planPrice") && ($("planPrice").value = plan.price ?? 0);
      $("planCurrency") && ($("planCurrency").value = plan.currency || "USD");
      $("planInterval") && ($("planInterval").value = plan.interval || "monthly");
      $("planDailyLimit") && ($("planDailyLimit").value = plan.dailyLimit || 0);
      $("planApiLimit") && ($("planApiLimit").value = plan.apiLimit || 0);
      $("planFeatures") && ($("planFeatures").value = (plan.features || []).join(", "));
      $("planActive") && ($("planActive").value = plan.active === false ? "false" : "true");
      showSection("monetization");
    }
    return;
  }

  const deletePlanButton = event.target.closest(".delete-plan");
  if (deletePlanButton) {
    deletePlan(deletePlanButton);
    return;
  }

  const cancelPaymentButton = event.target.closest(".cancel-payment");
  if (cancelPaymentButton) {
    cancelPayment(cancelPaymentButton);
    return;
  }
  const refundPaymentButton = event.target.closest(".refund-payment");
  if (refundPaymentButton) {
    refundPayment(refundPaymentButton);
    return;
  }

  const editSubscriptionButton = event.target.closest(".edit-subscription");
  if (editSubscriptionButton) {
    const subscription = state.apiSubscriptions?.find((item) => item._id === editSubscriptionButton.dataset.id);
    if (subscription) {
      state.editingSubscriptionId = subscription._id;
      $("subscriptionOwnerName") && ($("subscriptionOwnerName").value = subscription.ownerName || "");
      $("subscriptionOwnerEmail") && ($("subscriptionOwnerEmail").value = subscription.ownerEmail || "");
      $("subscriptionPlanSlug") && ($("subscriptionPlanSlug").value = subscription.planSlug || "free");
      $("subscriptionDailyLimit") && ($("subscriptionDailyLimit").value = subscription.dailyLimit || 0);
      $("subscriptionStatus") && ($("subscriptionStatus").value = subscription.status || "active");
      $("subscriptionApiKey") && ($("subscriptionApiKey").value = subscription.apiKey || "");
      showSection("monetization");
    }
    return;
  }

  const deleteSubscriptionButton = event.target.closest(".delete-subscription");
  if (deleteSubscriptionButton) {
    deleteApiSubscription(deleteSubscriptionButton);
    return;
  }

  const editAdButton = event.target.closest(".edit-ad");
  if (editAdButton) {
    const ad = state.ads.find((item) => item._id === editAdButton.dataset.id);
    if (ad) {
      state.editingAdId = ad._id;
      $("adTitle") && ($("adTitle").value = ad.title || "");
      $("adSubtitle") && ($("adSubtitle").value = ad.subtitle || "");
      $("adLocation") && ($("adLocation").value = ad.location || "");
      $("adCta") && ($("adCta").value = ad.cta || "");
      $("adImage") && ($("adImage").value = ad.image || "");
      $("adUrl") && ($("adUrl").value = ad.url || "");
      $("adPosition") && ($("adPosition").value = ad.position || "top");
      $("adActive") && ($("adActive").value = ad.active === false ? "false" : "true");
      showSection("monetization");
    }
    return;
  }

  const deleteAdButton = event.target.closest(".delete-ad");
  if (deleteAdButton) {
    deleteAd(deleteAdButton);
    return;
  }

  const editBlogButton = event.target.closest(".edit-blog-post");
  if (editBlogButton) {
    const post = state.blogPosts.find((item) => item._id === editBlogButton.dataset.id);
    if (post) {
      state.editingBlogPostId = post._id;
      $("blogTitle") && ($("blogTitle").value = post.title || "");
      $("blogSlug") && ($("blogSlug").value = post.slug || "");
      $("blogExcerpt") && ($("blogExcerpt").value = post.excerpt || "");
      $("blogContent") && ($("blogContent").value = post.content || "");
      $("blogMetaTitle") && ($("blogMetaTitle").value = post.metaTitle || "");
      $("blogMetaDescription") && ($("blogMetaDescription").value = post.metaDescription || "");
      $("blogStatus") && ($("blogStatus").value = post.status || "draft");
      showSection("content");
    }
    return;
  }

  const deleteBlogButton = event.target.closest(".delete-blog-post");
  if (deleteBlogButton) {
    deleteBlogPost(deleteBlogButton);
    return;
  }

  const deleteSubscriberButton = event.target.closest(".delete-subscriber");
  if (deleteSubscriberButton) {
    deleteSubscriber(deleteSubscriberButton);
    return;
  }

  const markContactButton = event.target.closest(".mark-contact");
  if (markContactButton) {
    markContactRead(markContactButton);
    return;
  }

  const deleteContactButton = event.target.closest(".delete-contact");
  if (deleteContactButton) {
    deleteContact(deleteContactButton);
    return;
  }
});

els.loginForm?.addEventListener("submit", login);
els.logoutBtn?.addEventListener("click", logout);
els.refreshAllBtn?.addEventListener("click", loadDashboard);
els.toolForm?.addEventListener("submit", saveTool);
els.resetBtn?.addEventListener("click", resetToolForm);
els.newToolBtn?.addEventListener("click", () => {
  resetToolForm();
  showSection("tools");
  $("name")?.focus();
});
els.searchInput?.addEventListener("input", renderTools);
els.statusFilter?.addEventListener("change", renderTools);
els.categoryFilter?.addEventListener("change", renderTools);
els.affiliateForm?.addEventListener("submit", saveAffiliate);
els.adForm?.addEventListener("submit", saveAd);
els.businessSettingsForm?.addEventListener("submit", saveBusinessSettings);
els.blogPostForm?.addEventListener("submit", saveBlogPost);
els.planForm?.addEventListener("submit", savePlan);
els.apiSubscriptionForm?.addEventListener("submit", saveApiSubscription);
$("name")?.addEventListener("input", () => {
  const slug = $("slug");
  if (slug && !slug.value) slug.value = slugify($("name").value);
});

(async function init() {
  renderSystem();
  updateToolFormTitle();
  if (api.token) {
    showAdmin();
    await loadDashboard();
  } else {
    showLogin();
  }
})();
