const SMART_MONETIZATION_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;

const smartPageOffers = {
  "pricing.html": {
    title: "Need more volume?",
    text: "Upgrade for higher limits, ad-free usage, API access, and business-ready support.",
    cta: "Compare plans",
    href: "pricing.html"
  },
  "api-marketplace.html": {
    title: "Build with Smart Tools APIs",
    text: "Create an API key and bring calculators, PDF tools, SEO utilities, and generators into your own product.",
    cta: "Request API access",
    href: "api-marketplace.html"
  },
  "advertise.html": {
    title: "Advertise on high-intent tools",
    text: "Reach users while they calculate, convert, optimize, and prepare files.",
    cta: "Request rates",
    href: "advertise.html"
  },
  "white-label.html": {
    title: "Launch tools under your brand",
    text: "License the platform for your company, niche site, or client portal.",
    cta: "Explore licensing",
    href: "white-label.html"
  },
  "ai-tools.html": {
    title: "Add premium AI workflows",
    text: "Package AI utilities, templates, and automations into paid plans.",
    cta: "See pricing",
    href: "pricing.html"
  },
  "blog.html": {
    title: "Turn readers into customers",
    text: "Use guides to promote tools, partner resources, paid plans, and API access.",
    cta: "See tools",
    href: "index.html"
  },
  "blog-post.html": {
    title: "Helpful tools for this guide",
    text: "Try Smart Tools Hub utilities or upgrade when you need more speed, limits, and business access.",
    cta: "Browse tools",
    href: "index.html"
  },
  "contact.html": {
    title: "Work with Smart Tools Hub",
    text: "Ask about advertising, API access, partnerships, white-label licensing, or custom tool builds.",
    cta: "View options",
    href: "advertise.html"
  }
};

function smartCurrentPage() {
  const page = window.location.pathname.split("/").pop();
  return page || "index.html";
}

function smartFallbackAd(position = "default") {
  const fallback = {
    top: ["Promote your business here", "Reach tool users with a high-visibility banner.", "Advertise"],
    sidebar: ["Sponsored resource", "Place a relevant offer beside calculators, PDF tools, SEO tools, and generators.", "Book slot"],
    middle: ["Upgrade your workflow", "Go Pro for higher limits, ad-free tools, and API access.", "See plans"],
    footer: ["Partner with Smart Tools Hub", "Sponsor guides, tools, and business placements.", "Get rates"],
    "in-tool": ["Recommended upgrade", "Unlock faster processing, higher usage, and premium resources.", "Upgrade"]
  }[position] || ["Sponsored placement", "This page is ready for direct ads or ad network code.", "Advertise"];

  return {
    title: fallback[0],
    text: fallback[1],
    cta: fallback[2],
    href: position === "middle" || position === "in-tool" ? "pricing.html" : "advertise.html"
  };
}

function smartRenderFallbackAd(container, position) {
  if (!container || container.dataset.smartFilled === "true") return;
  const ad = smartFallbackAd(position);
  container.dataset.smartFilled = "true";
  container.innerHTML = `
    <a class="managed-ad smart-fallback-ad" href="${ad.href}" data-smart-cta="${position}">
      <span class="ad-label">Sponsored</span>
      <strong>${ad.title}</strong>
      <small>${ad.text}</small>
      <em>${ad.cta}</em>
    </a>
  `;
}

async function smartFillAdSlot(slot) {
  const position = slot.dataset.adPosition || "default";

  if (typeof smartLoadAds === "function") {
    await smartLoadAds(position, `[data-smart-slot="${slot.dataset.smartSlot}"]`);
  }

  if (!slot.querySelector(".managed-ad")) {
    smartRenderFallbackAd(slot, position);
  }
}

function smartCreateAdSlot(position, label) {
  const slot = document.createElement("section");
  slot.className = `ad smart-ad-slot smart-ad-${position}`;
  slot.dataset.adPosition = position;
  slot.dataset.smartSlot = `${position}-${Math.random().toString(36).slice(2)}`;
  slot.setAttribute("aria-label", label || "Sponsored placement");
  return slot;
}

function smartInsertUniversalAds() {
  const isHomePage = ["", "/", "index.html"].includes(smartCurrentPage()) || window.location.pathname === "/";
  const main = document.querySelector("main") || document.querySelector(".layout") || document.body;
  const header = document.querySelector("header");
  const footer = document.querySelector("footer");

  if (!isHomePage && header && !document.querySelector("[data-smart-auto='top-ad']")) {
    const top = smartCreateAdSlot("top", "Top sponsored placement");
    top.dataset.smartAuto = "top-ad";
    header.insertAdjacentElement("afterend", top);
  }

  if (!isHomePage && main && !document.querySelector("[data-smart-auto='middle-ad']")) {
    const middle = smartCreateAdSlot("middle", "Featured sponsored placement");
    middle.dataset.smartAuto = "middle-ad";
    main.insertAdjacentElement("afterend", middle);
  }

  if (!isHomePage && footer && !document.querySelector("[data-smart-auto='footer-ad']")) {
    const bottom = smartCreateAdSlot("footer", "Footer sponsored placement");
    bottom.dataset.smartAuto = "footer-ad";
    footer.insertAdjacentElement("beforebegin", bottom);
  }

  document.querySelectorAll(".ad").forEach((slot, index) => {
    if (!slot.dataset.smartSlot) slot.dataset.smartSlot = `existing-${index}`;
    if (!slot.dataset.adPosition) {
      slot.dataset.adPosition = index === 0 ? "top" : index === 1 ? "sidebar" : "middle";
    }
  });

  document.querySelectorAll(".ad").forEach((slot) => smartFillAdSlot(slot));
}

function smartInsertRevenuePanel() {
  if (document.querySelector(".smart-revenue-panel")) return;

  const page = smartCurrentPage();
  if (page === "index.html" || window.location.pathname === "/") return;
  const offer = smartPageOffers[page] || {
    title: "Monetized tools platform",
    text: "Smart Tools Hub supports ad placements, affiliate offers, paid plans, API subscriptions, and direct advertiser leads.",
    cta: "View pricing",
    href: "pricing.html"
  };

  const panel = document.createElement("section");
  panel.className = "smart-revenue-panel";
  panel.innerHTML = `
    <div>
      <span>Revenue ready</span>
      <h2>${offer.title}</h2>
      <p>${offer.text}</p>
    </div>
    <a href="${offer.href}" data-smart-cta="revenue-panel">${offer.cta}</a>
  `;

  const footer = document.querySelector("footer");
  if (footer) footer.insertAdjacentElement("beforebegin", panel);
}

function smartTrackOutboundClicks() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href") || "";
    const isAffiliate = link.rel.includes("sponsored") || link.className.includes("affiliate") || link.dataset.smartCta;
    if (!isAffiliate) return;

    if (typeof smartTrack === "function") {
      smartTrack("monetization_click", {
        href,
        label: link.textContent.trim().slice(0, 120),
        placement: link.dataset.smartCta || link.closest(".ad")?.dataset.adPosition || "link"
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  smartInsertUniversalAds();
  smartInsertRevenuePanel();
  smartTrackOutboundClicks();
});
