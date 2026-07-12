const { tools } = require("../seedTools");

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/i, "")
    .replace(/&.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const fallbackTools = tools.map((tool) => ({
  ...tool,
  views: Number(tool.views || 0),
  affiliateClicks: Number(tool.affiliateClicks || 0),
  status: tool.status || "active"
}));

function getFallbackTools() {
  return fallbackTools.map((tool) => ({ ...tool }));
}

function getFallbackToolBySlug(slug) {
  const normalized = normalizeSlug(slug);
  return fallbackTools.find((tool) => normalizeSlug(tool.slug) === normalized) || null;
}

module.exports = {
  fallbackTools,
  getFallbackTools,
  getFallbackToolBySlug
};
