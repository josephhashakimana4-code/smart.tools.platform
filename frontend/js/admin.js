const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;

const TOKEN_KEY = "smartToolsAdminToken";

const $ = (id) => document.getElementById(id);
const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const number = (value) => Number(value || 0).toLocaleString();
const text = (value) => String(value || "").trim();

const state = {
  stats: {},
  tools: [],
  categories: [],
  trafficChart: null,
  categoryChart: null,
  loading: false
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
  message: $("message")
};

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
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

  headers() {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["x-admin-token"] = this.token;
    return headers;
  }

  async request(path, options = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...this.headers(),
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      this.clearToken();
      showLogin();
      throw new Error(data.message || "Admin login required.");
    }

    if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
    return data;
  }

  get(path) {
    return this.request(path);
  }

  post(path, body) {
    return this.request(path, { method: "POST", body: JSON.stringify(body) });
  }

  delete(path) {
    return this.request(path, { method: "DELETE" });
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
    const [stats, tools] = await Promise.all([
      api.get("/api/admin/stats"),
      api.get("/api/admin/tools")
    ]);
    state.stats = stats || {};
    state.tools = Array.isArray(tools) ? tools : [];
    state.categories = [...new Set(state.tools.map((tool) => tool.category).filter(Boolean))].sort();

    renderStats();
    renderCategoryFilter();
    renderTools();
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
  const stats = state.stats;
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
        <a class="small-btn as-link" href="tool.html?slug=${encodeURIComponent(tool.slug || "")}" target="_blank" rel="noopener">Open</a>
        <button class="danger-btn small-btn delete-tool" type="button" data-id="${escapeHtml(tool._id)}">Delete</button>
      </td>
    </tr>
  `).join("");
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
    await api.post("/api/admin/tools", data);
    resetToolForm();
    setMessage("Tool saved.");
    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

function resetToolForm() {
  els.toolForm?.reset();
  setMessage("");
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
  setText("apiBaseLabel", API_BASE);
}

document.addEventListener("click", (event) => {
  const menuButton = event.target.closest(".menu-btn");
  if (menuButton) showSection(menuButton.dataset.section);

  const deleteButton = event.target.closest(".delete-tool");
  if (deleteButton) deleteTool(deleteButton);
});

els.loginForm?.addEventListener("submit", login);
els.logoutBtn?.addEventListener("click", logout);
els.refreshAllBtn?.addEventListener("click", loadDashboard);
els.toolForm?.addEventListener("submit", saveTool);
els.resetBtn?.addEventListener("click", resetToolForm);
els.newToolBtn?.addEventListener("click", () => {
  showSection("tools");
  $("name")?.focus();
});
els.searchInput?.addEventListener("input", renderTools);
els.statusFilter?.addEventListener("change", renderTools);
els.categoryFilter?.addEventListener("change", renderTools);
$("name")?.addEventListener("input", () => {
  const slug = $("slug");
  if (slug && !slug.value) slug.value = slugify($("name").value);
});

(async function init() {
  renderSystem();
  if (api.token) {
    showAdmin();
    await loadDashboard();
  } else {
    showLogin();
  }
})();
