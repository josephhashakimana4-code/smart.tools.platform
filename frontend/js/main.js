let allTools = [];
let selectedCategory = "all";
let searchLogTimer = null;

/**
 * FIX: hard-set backend base to avoid file:// and empty string issues
 */
const API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;

async function loadTools() {
  try {
    const res = await fetch(`${API_BASE}/api/tools`);

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    const data = await res.json();

    allTools = sortTools(data);
    renderTools(allTools);

  } catch (err) {
    console.error("Failed to load tools", err);

    const container = document.getElementById("toolsContainer");
    container.innerHTML = `
      <p class="empty-state">
        Failed to load tools.<br>
        Check backend: ${API_BASE}/api/tools
      </p>
    `;
  }
}

function renderTools(tools) {
  const container = document.getElementById("toolsContainer");
  const summary = document.getElementById("toolsSummary");
  container.innerHTML = "";

  if (summary) {
    const categoryText = selectedCategory === "all"
      ? "All tools"
      : `${formatCategory(selectedCategory)} tools`;
    summary.textContent = `${categoryText}: ${tools.length} available`;
  }

  if (!tools.length) {
    container.innerHTML = `<p class="empty-state">No tools found.</p>`;
    return;
  }

  tools.forEach(tool => {
    const card = document.createElement("div");
    card.className = `tool-card tool-card-${tool.category || "utility"}`;

    card.innerHTML = `
      <div class="tool-card-top">
        <span class="tool-icon" aria-hidden="true">${categoryIcon(tool.category)}</span>
        <span class="tool-category">${formatCategory(tool.category)}</span>
      </div>
      <h3>${tool.name}</h3>
      <p>${tool.description || `Free ${formatCategory(tool.category)} tool for everyday tasks.`}</p>
      <div class="tool-actions">
        <a class="tool-btn" href="tool.html?slug=${encodeURIComponent(tool.slug)}">Use Tool</a>
        <a class="affiliate-link" href="${tool.affiliateUrl ? `${API_BASE}/api/tools/${encodeURIComponent(tool.slug)}/affiliate` : "affiliate-disclosure.html"}" target="_blank">
          ${tool.affiliateLabel || "Recommended Resource"}
        </a>
      </div>
    `;

    container.appendChild(card);
  });

  updateToolsItemListSchema(tools);
}

function updateToolsItemListSchema(tools) {
  const oldSchema = document.getElementById("toolsItemListSchema");
  if (oldSchema) oldSchema.remove();

  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.id = "toolsItemListSchema";
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: selectedCategory === "all" ? "Smart Tools Hub tools" : `${formatCategory(selectedCategory)} tools`,
    numberOfItems: tools.length,
    itemListElement: tools.slice(0, 24).map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tool.name,
      url: `${window.location.origin}/tool.html?slug=${encodeURIComponent(tool.slug)}`,
      description: tool.description || `Free ${formatCategory(tool.category)} tool.`
    }))
  });
  document.head.appendChild(schema);
}

function sortTools(tools) {
  const categoryOrder = {
    math: 1,
    utility: 2,
    health: 3,
    generator: 4,
    ai: 5,
    seo: 6,
    text: 7,
    finance: 8
  };

  return [...tools].sort((a, b) => {
    const categoryDiff = (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
    if (categoryDiff) return categoryDiff;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function formatCategory(category = "utility") {
  if (String(category).toLowerCase() === "ai") return "AI";
  return String(category)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryIcon(category = "utility") {
  return {
    math: "+",
    utility: "U",
    health: "H",
    generator: "G",
    ai: "AI",
    seo: "S",
    text: "T",
    finance: "$"
  }[category] || "U";
}

function filterTools() {
  const searchText = document.getElementById("searchInput").value.trim().toLowerCase();

  const filtered = allTools.filter(tool => {
    const text = `${tool.name} ${tool.category} ${tool.description || ""}`.toLowerCase();
    const matchesSearch = text.includes(searchText);
    const matchesCategory =
      selectedCategory === "all" || tool.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  renderTools(sortTools(filtered));
  scheduleSearchLog(searchText, filtered.length);
}

function scheduleSearchLog(query, resultCount) {
  clearTimeout(searchLogTimer);
  if (!query || query.length < 2) return;

  searchLogTimer = setTimeout(() => {
    fetch(`${API_BASE}/api/analytics/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, resultCount }),
      keepalive: true
    }).catch(() => {});
  }, 600);
}

async function handleNewsletter(event) {
  event.preventDefault();
  const email = document.getElementById("newsletterEmail").value.trim();
  const message = document.getElementById("newsletterMessage");
  try {
    const res = await fetch(`${API_BASE}/api/analytics/newsletter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Unable to subscribe.");
    message.textContent = "Subscribed successfully.";
    event.target.reset();
  } catch (err) {
    message.textContent = err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadTools().then(applyInitialSearch);
  if (typeof smartLoadAds === "function") {
    smartLoadAds("top", '[data-ad-position="top"]');
    smartLoadAds("sidebar", ".sidebar .ad");
  }

  document.getElementById("searchInput").addEventListener("input", filterTools);
  document.getElementById("newsletterForm")?.addEventListener("submit", handleNewsletter);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});

  document.querySelectorAll(".categories button").forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;

      document.querySelectorAll(".categories button")
        .forEach(btn => btn.classList.remove("active"));

      button.classList.add("active");

      filterTools();
    });
  });
});

function applyInitialSearch() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q");
  const category = params.get("category");
  const searchInput = document.getElementById("searchInput");

  if (category && document.querySelector(`.categories button[data-category="${category}"]`)) {
    selectedCategory = category;
    document.querySelectorAll(".categories button").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`.categories button[data-category="${category}"]`)?.classList.add("active");
  }

  if (query && searchInput) searchInput.value = query;
  if (query || category) filterTools();
}
