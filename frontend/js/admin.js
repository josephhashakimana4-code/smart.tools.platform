const API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:5000"
    : window.location.origin;

const TOKEN_KEY = "smartToolsAdminToken";

/* =========================
   API CLIENT
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

  /* 🔴 FIXED: backend expects x-admin-token */
  headers() {
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["x-admin-token"] = this.token;
    }

    return headers;
  }

  async request(path, options = {}) {
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

    /* SESSION HANDLING */
    if (res.status === 401) {
      this.clearToken();
      window.location.href = "/admin.html";
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
};

/* =========================
   DOM
========================= */
const els = {
  loginScreen: document.getElementById("loginScreen"),
  adminApp: document.getElementById("adminApp"),
  loginForm: document.getElementById("loginForm"),
  adminPassword: document.getElementById("adminPassword"),
  loginMessage: document.getElementById("loginMessage"),
  logoutBtn: document.getElementById("logoutBtn"),
  refreshAllBtn: document.getElementById("refreshAllBtn"),
  toolsTable: document.getElementById("toolsTable"),
};

/* =========================
   UI SWITCH
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
   DASHBOARD LOADING
========================= */
async function loadDashboard() {
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
  }
}

/* =========================
   STATS RENDER (SAFE)
========================= */
function renderStats(stats) {
  setText("totalTools", stats.totalTools ?? stats.total ?? 0);
  setText("activeTools", stats.activeTools ?? stats.active ?? 0);
  setText("viewCount", stats.views ?? 0);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* =========================
   TOOLS TABLE
========================= */
function renderTools(tools) {
  if (!els.toolsTable) return;

  els.toolsTable.innerHTML = "";

  tools.forEach((t) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${t.name || "-"}</td>
      <td>${t.category || "-"}</td>
      <td>${t.status || "-"}</td>
      <td>${t.views || 0}</td>
      <td>
        <button data-id="${t._id}" class="delete-btn">Delete</button>
      </td>
    `;

    els.toolsTable.appendChild(row);
  });

  /* DELETE HANDLER */
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      if (!confirm("Delete this tool?")) return;

      try {
        await api.delete(`/api/admin/tools/${id}`);
        await loadDashboard();
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

/* =========================
   EVENTS
========================= */
els.loginForm.addEventListener("submit", login);
els.logoutBtn.addEventListener("click", logout);
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
