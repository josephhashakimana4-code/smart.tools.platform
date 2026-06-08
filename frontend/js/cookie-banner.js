(function () {
  const key = "smartToolsCookieConsent";

  if (localStorage.getItem(key) === "accepted") {
    return;
  }

  window.addEventListener("DOMContentLoaded", () => {
    const banner = document.createElement("div");
    banner.className = "cookie-banner";
    banner.innerHTML = `
      <p>We use cookies and third-party services for ads, affiliate tracking, analytics, and site improvement. <a href="cookies.html">Learn more</a>.</p>
      <button type="button">Accept</button>
    `;

    banner.querySelector("button").addEventListener("click", () => {
      localStorage.setItem(key, "accepted");
      banner.remove();
    });

    document.body.appendChild(banner);
  });
})();
