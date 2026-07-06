const API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:5000"
    : window.location.origin;

const TOKEN_KEY = "smartToolsAdminToken";

/* =========================
   API CLIENT (CENTRALIZED)
========================= */
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
    return {
      "Content-Type": "application/json",
      "x-admin-token": this.token,
    };
  }

  async request(path, options = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...this.headers(),
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      this.clearToken();
      throw new Error("SESSION_EXPIRED");
    }

    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    return data;
  }

  get(p) { return this.request(p); }
  post(p, b) { return this.request(p, { method: "POST", body: JSON.stringify(b) }); }
  put(p, b) { return this.request(p, { method: "PUT", body: JSON.stringify(b) }); }
  patch(p, b) { return this.request(p, { method: "PATCH", body: JSON.stringify(b) }); }
  delete(p) { return this.request(p, { method: "DELETE" }); }
}

const api = new ApiClient(API_BASE);

/* =========================
   STATE
========================= */
const state = {
  tools: [],
  ads: [],
  blog: [],
  business: null,
  categories: [],
};

/* =========================
   DOM CACHE
========================= */
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

  toolsTable: document.getElementById("toolsTable"),
  toolsSummary: document.getElementById("toolsSummary"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  message: document.getElementById("message"),

  loginForm: document.getElementById("loginForm"),
};

/* =========================
   HELPERS
========================= */
const slugify = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const number = (v) => Number(v || 0).toLocaleString();

function setMessage(text, error = false) {
  els.message.textContent = text;
  els.message.classList.toggle("error", error);
}

function setLoginMessage(text) {
  els.loginMessage.textContent = text;
}

/* =========================
   AUTH UI
========================= */
function showAdmin() {
  els.loginScreen.classList.add("hidden");
  els.adminApp.classList.remove("hidden");
}

function showLogin() {
  els.adminApp.classList.add("hidden");
  els.loginScreen.classList.remove("hidden");
}

/* =========================
   AUTH
========================= */
async function login(e) {
  e.preventDefault();
  setLoginMessage("");

  try {
    const data = await api.post("/api/admin/login", {
      password: els.adminPassword.value,
    });

    api.token = data.token;
    els.adminPassword.value = "";

    showAdmin();
    await loadDashboard();
  } catch (err) {
    setLoginMessage(err.message);
  }
}

async function logout() {
  try {
    await api.post("/api/admin/logout", {});
  } catch {}

  api.clearToken();
  showLogin();
}

/* =========================
   DASHBOARD LOADER (OPTIMIZED)
========================= */
async function loadDashboard() {
  try {
    const [stats, tools, ads, blog, business] = await Promise.all([
      api.get("/api/admin/stats"),
      api.get("/api/admin/tools"),
      api.get("/api/admin/ads"),
      api.get("/api/admin/blog"),
      api.get("/api/admin/business"),
    ]);

    state.tools = tools;
    state.ads = ads;
    state.blog = blog;
    state.business = business;
    state.categories = stats.categories?.map((c) => c._id) || [];

    renderAll({ stats, tools });
  } catch (err) {
    if (err.message === "SESSION_EXPIRED") {
      showLogin();
    } else {
      console.error(err);
    }
  }
}

/* =========================
   RENDER CORE
========================= */
function renderAll({ stats, tools }) {
  renderStats(stats);
  renderTools(tools);
}

function renderStats(stats) {
  document.getElementById("totalTools").textContent = number(stats.total);
  document.getElementById("activeTools").textContent = number(stats.active);
  document.getElementById("viewCount").textContent = number(stats.views);
}

/* =========================
   TOOLS
========================= */
function renderTools(tools) {
  els.toolsTable.innerHTML = "";
  els.toolsSummary.textContent = `${tools.length} tools`;

  if (!tools.length) {
    els.toolsTable.innerHTML =
      `<tr><td colspan="6" class="muted">No tools found</td></tr>`;
    return;
  }

  tools.forEach((t) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${t.name}</td>
      <td>${t.category}</td>
      <td>${t.status}</td>
      <td>${number(t.views)}</td>
      <td>${number(t.affiliateClicks)}</td>
      <td>
        <button data-action="edit" data-id="${t._id}">Edit</button>
        <button data-action="toggle" data-id="${t._id}">Toggle</button>
        <button data-action="delete" data-id="${t._id}">Delete</button>
      </td>
    `;

    els.toolsTable.appendChild(row);
  });
}

/* =========================
   TOOL ACTIONS
========================= */
async function handleToolClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const tool = state.tools.find((t) => t._id === id);

  try {
    if (btn.dataset.action === "delete") {
      if (!confirm("Delete tool?")) return;
      await api.delete(`/api/admin/tools/${id}`);
    }

    if (btn.dataset.action === "toggle") {
      const status = tool.status === "active" ? "inactive" : "active";
      await api.patch(`/api/admin/tools/${id}/status`, { status });
    }

    if (btn.dataset.action === "edit") {
      console.log("Edit tool:", tool);
    }

    await loadDashboard();
  } catch (err) {
    setMessage(err.message, true);
  }
}

/* =========================
   TOOL SAVE
========================= */
async function saveTool(e) {
  e.preventDefault();

  const payload = {
    name: document.getElementById("name").value,
    slug: slugify(document.getElementById("slug").value),
    category: document.getElementById("category").value,
    status: document.getElementById("status").value,
  };

  const id = document.getElementById("toolId").value;

  try {
    if (id) {
      await api.put(`/api/admin/tools/${id}`, payload);
    } else {
      await api.post(`/api/admin/tools`, payload);
    }

    await loadDashboard();
    setMessage("Saved successfully");
  } catch (err) {
    setMessage(err.message, true);
  }
}

/* =========================
   SECTION SWITCH
========================= */
function activateSection(name) {
  els.menuButtons.forEach((b) =>
    b.classList.toggle("active", b.dataset.section === name)
  );

  els.sections.forEach((s) =>
    s.classList.toggle("active", s.id === `${name}Section`)
  );
}

/* =========================
   EVENTS
========================= */
els.loginForm.addEventListener("submit", login);
els.logoutBtn.addEventListener("click", logout);

els.menuButtons.forEach((b) =>
  b.addEventListener("click", () => activateSection(b.dataset.section))
);

els.toolsTable.addEventListener("click", handleToolClick);
document.getElementById("toolForm").addEventListener("submit", saveTool);

els.refreshAllBtn.addEventListener("click", loadDashboard);

/* =========================
   INIT
========================= */
if (api.token) {
  showAdmin();
  loadDashboard().catch(showLogin);
} else {
  showLogin();
}
