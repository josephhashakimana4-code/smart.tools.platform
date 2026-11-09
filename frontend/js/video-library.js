(() => {
  const apiBase = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;
  const grid = document.getElementById("videoGrid");
  const searchInput = document.getElementById("videoSearch");
  const categoryFilter = document.getElementById("videoCategoryFilter");
  const resultCount = document.getElementById("videoResultCount");
  if (!grid) return;
  let allVideos = [];

  function safeMediaUrl(value) {
    const raw = String(value || "").trim();
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    try {
      const parsed = new URL(raw);
      return parsed.protocol === "https:" ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function cardFor(video) {
    const source = safeMediaUrl(video.videoUrl);
    if (!source) return null;
    const article = document.createElement("article");
    article.className = "video-card";
    const player = document.createElement("video");
    player.controls = true;
    player.preload = "metadata";
    player.playsInline = true;
    player.setAttribute("aria-label", video.title || "Video tutorial");
    player.src = source;
    const poster = safeMediaUrl(video.thumbnailUrl);
    if (poster) player.poster = poster;
    const title = document.createElement("h3");
    title.textContent = video.title || "Video tutorial";
    const description = document.createElement("p");
    description.textContent = video.description || "A practical Smart Tools Hub walkthrough.";
    const category = document.createElement("span");
    category.className = "video-category";
    category.textContent = video.category || "Tutorial";
    const views = document.createElement("small");
    views.className = "video-views";
    views.textContent = `${Number(video.views || 0).toLocaleString()} engaged plays`;
    let engaged = false;
    let playedSeconds = 0;
    let previousTime = null;
    let requestPending = false;
    const viewKey = `smartVideoView:${video._id}`;
    try { engaged = sessionStorage.getItem(viewKey) === "1"; } catch {}
    player.addEventListener("playing", () => { previousTime = player.currentTime; });
    player.addEventListener("seeking", () => { previousTime = player.currentTime; });
    player.addEventListener("timeupdate", () => {
      if (player.paused || engaged || requestPending) return;
      const currentTime = player.currentTime;
      if (previousTime !== null) {
        const delta = currentTime - previousTime;
        if (delta > 0 && delta <= 2.5) playedSeconds += delta;
      }
      previousTime = currentTime;
      const threshold = Number.isFinite(player.duration) && player.duration < 12
        ? Math.max(2, player.duration * 0.75)
        : 10;
      if (playedSeconds < threshold) return;
      requestPending = true;
      fetch(`${apiBase}/api/videos/${encodeURIComponent(video._id)}/view`, { method: "POST", keepalive: true })
        .then((response) => response.ok ? response.json() : null)
        .then((result) => {
          if (!result?.success) {
            requestPending = false;
            return;
          }
          engaged = true;
          try { sessionStorage.setItem(viewKey, "1"); } catch {}
          if (result?.views !== undefined) views.textContent = `${Number(result.views).toLocaleString()} engaged plays`;
          if (typeof window.smartTrack === "function") window.smartTrack("video_engaged_play", { videoSlug: video.slug, path: window.location.pathname });
        })
        .catch(() => { requestPending = false; });
    });
    const copy = document.createElement("div");
    copy.className = "video-card-copy";
    copy.append(category, title, description, views);
    article.append(player, copy);
    const toolUrl = safeMediaUrl(video.toolUrl);
    if (toolUrl) {
      const toolLink = document.createElement("a");
      toolLink.className = "video-tool-link";
      toolLink.dataset.smartCta = "video-related-tool";
      toolLink.href = toolUrl;
      toolLink.textContent = video.toolLabel || "Try the related tool";
      article.appendChild(toolLink);
    }
    return article;
  }

  function renderVideos() {
    const query = String(searchInput?.value || "").trim().toLowerCase();
    const category = categoryFilter?.value || "";
    const filtered = allVideos.filter((video) => {
      const matchesQuery = !query || `${video.title || ""} ${video.description || ""} ${video.category || ""}`.toLowerCase().includes(query);
      return matchesQuery && (!category || video.category === category);
    });
    if (resultCount) resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "tutorial" : "tutorials"}`;
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "video-status";
      empty.textContent = allVideos.length ? "No tutorials match those filters." : "New tutorials are being prepared. Please check back soon.";
      grid.replaceChildren(empty);
      return;
    }
    grid.replaceChildren(...filtered.map(cardFor).filter(Boolean));
  }

  searchInput?.addEventListener("input", renderVideos);
  categoryFilter?.addEventListener("change", renderVideos);

  fetch(`${apiBase}/api/videos`)
    .then((response) => {
      if (!response.ok) throw new Error("Video library is temporarily unavailable.");
      return response.json();
    })
    .then((videos) => {
      allVideos = Array.isArray(videos) ? videos : [];
      const categories = [...new Set(allVideos.map((video) => String(video.category || "Tutorial")))].sort();
      categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter?.append(option);
      });
      grid.setAttribute("aria-busy", "false");
      renderVideos();
    })
    .catch((error) => {
      grid.setAttribute("aria-busy", "false");
      const message = document.createElement("p");
      message.className = "video-status";
      message.textContent = error.message;
      grid.replaceChildren(message);
    });
})();
