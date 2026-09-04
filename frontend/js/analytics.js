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
    const ads = await res.json();
    if (!ads.length) return;

    const ad = ads[0];
    container.innerHTML = `
      <a class="managed-ad" href="${ad.url || "#"}" target="_blank" rel="sponsored nofollow noopener" data-ad-id="${ad._id}">
        ${ad.image ? `<img src="${ad.image}" alt="${ad.title}">` : `<span class="ad-mark">PT</span>`}
        <span class="ad-copy">
          <strong>${ad.title}</strong>
          ${ad.subtitle ? `<small>${ad.subtitle}</small>` : ""}
          ${ad.location ? `<small>${ad.location}</small>` : ""}
        </span>
        <em>${ad.cta || "Learn more"}</em>
      </a>
    `;
    container.querySelector("a")?.addEventListener("click", () => {
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

async function smartLoadBusinessSettings() {
  if (smartBusinessSettingsLoaded) return;
  smartBusinessSettingsLoaded = true;

  try {
    const res = await fetch(`${SMART_ANALYTICS_BASE}/api/business/settings`);
    const settings = await res.json();

    if (settings.brandName) {
      document.querySelectorAll("[data-brand-name]").forEach((node) => {
        node.textContent = settings.brandName;
      });
    }

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
  }
}

document.addEventListener("DOMContentLoaded", () => {
  smartTrack("page_view");
  smartLoadBusinessSettings();
});
