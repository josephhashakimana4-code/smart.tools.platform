/**
 * Global API + CSRF helper
 * Load this file before other frontend JavaScript files.
 */
(function () {
  let csrfToken = null;
  let csrfPromise = null;

  const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

  async function getCsrfToken(forceRefresh = false) {
    if (csrfToken && !forceRefresh) return csrfToken;

    if (csrfPromise && !forceRefresh) return csrfPromise;

    csrfPromise = fetch("/api/auth/csrf-token", {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.csrfToken) {
          throw new Error(data.message || "Unable to obtain CSRF token");
        }

        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });

    return csrfPromise;
  }

  async function apiFetch(url, options = {}) {
    const config = { ...options };
    const method = String(config.method || "GET").toUpperCase();

    config.credentials = config.credentials || "include";
    config.headers = {
      ...(config.headers || {})
    };

    if (!SAFE_METHODS.has(method)) {
      const token = await getCsrfToken();

      if (!config.headers["X-CSRF-Token"]) {
        config.headers["X-CSRF-Token"] = token;
      }
    }

    let response = await fetch(url, config);

    // Retry once with a fresh token if the token expired/was invalid.
    if (
      !SAFE_METHODS.has(method) &&
      response.status === 403
    ) {
      const data = await response.clone().json().catch(() => ({}));

      if (
        data.code === "CSRF_INVALID" ||
        data.code === "CSRF_EXPIRED" ||
        data.code === "CSRF_MISSING"
      ) {
        csrfToken = null;

        const freshToken = await getCsrfToken(true);

        config.headers["X-CSRF-Token"] = freshToken;

        response = await fetch(url, config);
      }
    }

    return response;
  }

  window.getCsrfToken = getCsrfToken;
  window.apiFetch = apiFetch;
})();
