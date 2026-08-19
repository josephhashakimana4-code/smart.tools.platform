let allTools = [];
let categoryTools = [];

const API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:5000"
    : window.location.origin;

const categoryConfig = {
  math: {
    title: "Math Tools",
    description: "Free online math tools and calculators for everyday calculations, percentages, equations, and more."
  },
  utility: {
    title: "Utility Tools",
    description: "Free online utility tools for everyday conversions, calculations, documents, and productivity tasks."
  },
  health: {
    title: "Health Tools",
    description: "Free online health calculators and useful tools for everyday health and wellness calculations."
  },
  generator: {
    title: "Generators",
    description: "Free online generators for creating useful content, values, names, text, and other resources."
  },
  ai: {
    title: "AI Tools",
    description: "Free AI-powered tools for prompts, emails, content creation, business ideas, and productivity."
  },
  seo: {
    title: "SEO Tools",
    description: "Free SEO tools for keywords, metadata, search optimization, and website analysis."
  },
  text: {
    title: "Text Tools",
    description: "Free online text tools for formatting, transforming, counting, cleaning, and analyzing text."
  },
  finance: {
    title: "Finance Tools",
    description: "Free online finance calculators and tools for money, percentages, loans, and everyday financial calculations."
  }
};

function formatCategory(category = "utility") {
  if (String(category).toLowerCase() === "ai") return "AI";

  return String(category)
    .replace(/-/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
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

function sortTools(tools) {
  return [...tools].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function renderTools(tools) {
  const container = document.getElementById("toolsContainer");
  const summary = document.getElementById("toolsSummary");

  container.innerHTML = "";

  summary.textContent = `${tools.length} ${tools.length === 1 ? "tool" : "tools"} available`;

  if (!tools.length) {
    container.innerHTML =
      '<p class="empty-state">No tools found in this category.</p>';
    return;
  }

  tools.forEach(tool => {
    const card = document.createElement("div");

    card.className =
      `tool-card tool-card-${tool.category || "utility"}`;

    const affiliateHref = tool.affiliateUrl
      ? `${API_BASE}/api/tools/${encodeURIComponent(tool.slug)}/affiliate`
      : "/affiliate-disclosure.html";

    card.innerHTML = `
      <div class="tool-card-top">
        <span class="tool-icon" aria-hidden="true">
          ${categoryIcon(tool.category)}
        </span>

        <span class="tool-category">
          ${formatCategory(tool.category)}
        </span>
      </div>

      <h3>${escapeHtml(tool.name || "Tool")}</h3>

      <p>
        ${escapeHtml(
          tool.description ||
          `Free ${formatCategory(tool.category)} tool for everyday tasks.`
        )}
      </p>

      <div class="tool-actions">
        <a
          class="tool-btn"
          href="/tools/${encodeURIComponent(tool.slug)}"
        >
          Use Tool
        </a>

        <a
          class="affiliate-link"
          href="${affiliateHref}"
          target="_blank"
          rel="sponsored nofollow noopener"
        >
          ${escapeHtml(tool.affiliateLabel || "Recommended Resource")}
        </a>
      </div>
    `;

    container.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadCategoryTools() {
  const slug = window.location.pathname
    .replace(/^\/tools\/?/, "")
    .replace(/\/$/, "")
    .toLowerCase();

  const categoryKey = slug === "generators" ? "generator" : slug;
  const config = categoryConfig[categoryKey];

  if (!config) {
    document.getElementById("toolsContainer").innerHTML =
      '<p class="empty-state">Category not found.</p>';
    return;
  }

  document.title = `${config.title} | Smart Tools Hub`;

  document.getElementById("categoryName").textContent = config.title;
  document.getElementById("categoryDescription").textContent =
    config.description;
  document.getElementById("toolsHeading").textContent = config.title;

  try {
    const res = await fetch(`${API_BASE}/api/tools`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    allTools = await res.json();

    categoryTools = sortTools(
      allTools.filter(tool =>
        String(tool.category || "").toLowerCase() === categoryKey &&
        tool.status !== "inactive"
      )
    );

    renderTools(categoryTools);

  } catch (error) {
    console.error("Failed to load category tools:", error);

    document.getElementById("toolsContainer").innerHTML =
      '<p class="empty-state">Failed to load tools. Please try again.</p>';
  }
}

function filterCategoryTools() {
  const query =
    document.getElementById("searchInput").value
      .trim()
      .toLowerCase();

  const filtered = categoryTools.filter(tool => {
    const text =
      `${tool.name || ""} ${tool.description || ""} ${tool.category || ""}`
        .toLowerCase();

    return text.includes(query);
  });

  renderTools(filtered);
}

document.addEventListener("DOMContentLoaded", () => {
  loadCategoryTools();

  document
    .getElementById("searchInput")
    ?.addEventListener("input", filterCategoryTools);

  if (typeof smartLoadAds === "function") {
    smartLoadAds("top", '[data-ad-position="top"]');
    smartLoadAds("bottom", '[data-ad-position="bottom"]');
  }
});
