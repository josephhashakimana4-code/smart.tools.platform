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

  headers() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.token}`,
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
  toolsSummary: document.getElementById("toolsSummary"),
  message: document.getElementById("message"),
};

/* =========================
   UI
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

  try {
    const data = await api.post("/api/admin/login", {
      password: els.adminPassword.value,
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
  api.clearToken();
  showLogin();
}

/* =========================
   DASHBOARD
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
      console.error(err);
    }
  }
}

function renderStats(stats) {
  document.getElementById("totalTools").textContent = stats.total;
  document.getElementById("activeTools").textContent = stats.active;
  document.getElementById("viewCount").textContent = stats.views;
}

function renderTools(tools) {
  els.toolsTable.innerHTML = "";

  tools.forEach((t) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${t.name}</td>
      <td>${t.category}</td>
      <td>${t.status}</td>
      <td>${t.views}</td>
      <td>
        <button data-id="${t._id}" data-action="delete">Delete</button>
      </td>
    `;

    els.toolsTable.appendChild(row);
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
