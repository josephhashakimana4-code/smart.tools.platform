const SMART_ANALYTICS_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;
let smartBusinessSettingsLoaded = false;

function smartTrack(type, metadata = {}) {
  apiFetch(`${SMART_ANALYTICS_BASE}/api/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer,
      ...metadata
    }),
    keepalive: true
  }).catch(() => {});
}

async function smartLoadAds(position, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  try {
    const res = await fetch(`${SMART_ANALYTICS_BASE}/api/analytics/ads?position=${encodeURIComponent(position)}`);
    if (!res.ok) throw new Error(`Ads request failed (${res.status}).`);
    const ads = await res.json();
    if (!ads.length) return;

    const ad = ads[0];
    let destination;
    try {
      destination = new URL(ad.url, window.location.origin);
      if (!["http:", "https:"].includes(destination.protocol)) destination = null;
    } catch {
      destination = null;
    }

    const card = document.createElement(destination ? "a" : "div");
    card.className = "managed-ad";
    if (destination) {
      card.href = destination.href;
      card.target = "_blank";
      card.rel = "sponsored nofollow noopener";
      card.dataset.adId = ad._id;
    }

    if (ad.image) {
      const image = document.createElement("img");
      image.src = ad.image;
      image.alt = ad.title || "Sponsored placement";
      card.appendChild(image);
    } else {
      const mark = document.createElement("span");
      mark.className = "ad-mark";
      mark.textContent = "PT";
      card.appendChild(mark);
    }

    const copy = document.createElement("span");
    copy.className = "ad-copy";
    const title = document.createElement("strong");
    title.textContent = ad.title || "Sponsored placement";
    copy.appendChild(title);
    [ad.subtitle, ad.location].filter(Boolean).forEach((value) => {
      const detail = document.createElement("small");
      detail.textContent = value;
      copy.appendChild(detail);
    });
    card.appendChild(copy);

    const cta = document.createElement("em");
    cta.textContent = ad.cta || "Learn more";
    card.appendChild(cta);
    if (!destination) {
      const status = document.createElement("small");
      status.textContent = "This placement is not linked yet.";
      card.appendChild(status);
    }
    container.replaceChildren(card);

    if (destination) card.addEventListener("click", () => {
      apiFetch(`${SMART_ANALYTICS_BASE}/api/analytics/ads/${ad._id}/click`, {
        method: "POST",
        keepalive: true
      }).catch(() => {});
    });
  } catch (err) {
    console.warn("Ads unavailable", err);
  }
}

function smartInjectCode(id, code) {
  if (!code || document.getElementById(id)) return;

  const wrapper = document.createElement("div");
  wrapper.id = id;
  wrapper.hidden = true;
  document.body.appendChild(wrapper);

  const template = document.createElement("template");
  template.innerHTML = code;

  [...template.content.childNodes].forEach((node) => {
    if (node.nodeName.toLowerCase() === "script") {
      const script = document.createElement("script");
      [...node.attributes].forEach((attr) => script.setAttribute(attr.name, attr.value));
      script.text = node.textContent;
      document.head.appendChild(script);
    } else {
      wrapper.appendChild(node.cloneNode(true));
    }
  });
}

function applyBrandText(value, fallbackValue = "Smart Tools Hub") {
  const brandName = value && String(value).trim() ? String(value).trim() : fallbackValue;
  const brandPattern = /(Smart Tools Hub|Smart Tools Platform)/gi;

  const replaceBrand = (text) => {
    if (!text) return text;
    return text.replace(brandPattern, brandName);
  };

  document.querySelectorAll("[data-brand-name]").forEach((node) => {
    node.textContent = brandName;
  });

  document.querySelectorAll("[data-brand-label]").forEach((node) => {
    node.textContent = brandName;
  });

  document.title = replaceBrand(document.title);

  [
    "meta[property='og:title']",
    "meta[name='twitter:title']",
    "meta[name='twitter:site']",
    "meta[name='application-name']"
  ].forEach((selector) => {
    const tag = document.querySelector(selector);
    if (tag && tag.content) {
      tag.content = replaceBrand(tag.content);
    }
  });

  document.documentElement.setAttribute("data-brand-name", brandName);
}

async function smartLoadBusinessSettings() {
  if (smartBusinessSettingsLoaded) return;
  smartBusinessSettingsLoaded = true;

  try {
    const res = await fetch(`${SMART_ANALYTICS_BASE}/api/business/settings`);
    const settings = await res.json();

    applyBrandText(settings?.brandName || "Smart Tools Hub");

    if (settings.adsensePublisherId && !document.getElementById("smart-adsense-script")) {
      const script = document.createElement("script");
      script.id = "smart-adsense-script";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(settings.adsensePublisherId)}`;
      document.head.appendChild(script);
    }

    smartInjectCode("smart-propellerads-code", settings.propellerAdsCode);
    smartInjectCode("smart-adsterra-code", settings.adsterraCode);
  } catch (err) {
    console.warn("Business settings unavailable", err);
    applyBrandText("Smart Tools Hub");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  smartTrack("page_view");
  smartLoadBusinessSettings();
});
