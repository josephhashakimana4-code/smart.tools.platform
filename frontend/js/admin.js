const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://YOUR-RENDER-BACKEND.onrender.com"; // 🔴 CHANGE THIS

const TOKEN_KEY = "smartToolsAdminToken";

/* =========================
   API CLIENT (ROBUST)
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
    const h = {
      "Content-Type": "application/json",
    };

    if (this.token) h["x-admin-token"] = this.token;

    return h;
  }

  async request(path, options = {}) {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          ...this.headers(),
          ...(options.headers || {}),
        },
      });

      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (res.status === 401) {
        this.clearToken();
        window.location.href = "/admin.html";
        throw new Error("SESSION_EXPIRED");
      }

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      return data;
    } catch (err) {
      console.error("API ERROR:", err);
      throw err;
    }
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
  loading: false,
};

/* =========================
   DOM SAFE ACCESS
========================= */
const $ = (id) => document.getElementById(id);

const els = {
  loginScreen: $("loginScreen"),
  adminApp: $("adminApp"),
  loginForm: $("loginForm"),
  adminPassword: $("adminPassword"),
  loginMessage: $("loginMessage"),
  logoutBtn: $("logoutBtn"),
  refreshAllBtn: $("refreshAllBtn"),
  toolsTable: $("toolsTable"),
};

/* =========================
   UI
========================= */
function showAdmin() {
  els.loginScreen?.classList.add("hidden");
  els.adminApp?.classList.remove("hidden");
}

function showLogin() {
  els.adminApp?.classList.add("hidden");
  els.loginScreen?.classList.remove("hidden");
}

/* =========================
   LOGIN
========================= */
async function login(e) {
  e.preventDefault();

  try {
    const data = await api.post("/api/admin/login", {
      password: els.adminPassword.value,
    });

    api.token = data.token;
    els.adminPassword.value = "";
    els.loginMessage.textContent = "";

    showAdmin();
    await loadDashboard();
  } catch (err) {
    els.loginMessage.textContent = err.message;
  }
}

/* =========================
   LOGOUT
========================= */
async function logout() {
  try {
    await api.post("/api/admin/logout");
  } catch {}

  api.clearToken();
  showLogin();
}

/* =========================
   DASHBOARD
========================= */
async function loadDashboard() {
  if (state.loading) return;
  state.loading = true;

  try {
    const [stats, tools] = await Promise.all([
      api.get("/api/admin/stats"),
      api.get("/api/admin/tools"),
    ]);

    state.tools = tools;

    renderStats(stats);
    renderTools(tools);
  } catch (err) {
    if (err.message === "SESSION_EXPIRED") {
      showLogin();
    } else {
      console.error("Dashboard error:", err);
    }
  } finally {
    state.loading = false;
  }
}

/* =========================
   STATS
========================= */
function renderStats(stats = {}) {
  setText("totalTools", stats.total ?? stats.totalTools ?? 0);
  setText("activeTools", stats.active ?? stats.activeTools ?? 0);
  setText("viewCount", stats.views ?? 0);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

/* =========================
   TOOLS TABLE (OPTIMIZED)
========================= */
function renderTools(tools = []) {
  if (!els.toolsTable) return;

  els.toolsTable.innerHTML = tools
    .map(
      (t) => `
      <tr>
        <td>${t.name || "-"}</td>
        <td>${t.category || "-"}</td>
        <td>${t.status || "-"}</td>
        <td>${t.views || 0}</td>
        <td>
          <button class="delete-btn" data-id="${t._id}">Delete</button>
        </td>
      </tr>
    `
    )
    .join("");
}

/* =========================
   EVENT DELEGATION (FIXED)
========================= */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".delete-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  if (!confirm("Delete this tool?")) return;

  try {
    await api.delete(`/api/admin/tools/${id}`);
    await loadDashboard();
  } catch (err) {
    alert(err.message);
  }
});

/* =========================
   EVENTS
========================= */
els.loginForm?.addEventListener("submit", login);
els.logoutBtn?.addEventListener("click", logout);
els.refreshAllBtn?.addEventListener("click", loadDashboard);

/* =========================
   INIT
========================= */
(async function init() {
  try {
    if (api.token) {
      showAdmin();
      await loadDashboard();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error(err);
    showLogin();
  }
})();
