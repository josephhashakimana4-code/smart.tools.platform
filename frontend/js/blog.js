const BLOG_API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;

async function loadBlogPosts() {
  const container = document.getElementById("blogList");
  try {
    const res = await fetch(`${BLOG_API_BASE}/api/blog`);
    const posts = await res.json();
    if (!posts.length) {
      container.innerHTML = `<p class="empty-state">No articles published yet.</p>`;
      return;
    }

    container.innerHTML = "";
    posts.forEach((post) => {
      const card = document.createElement("article");
      card.className = "tool-card";
      card.innerHTML = `
        <h3>${post.title}</h3>
        <p>${post.excerpt || post.metaDescription || "Read this Smart Tools Hub guide."}</p>
        <a class="tool-btn" href="/blog/${encodeURIComponent(post.slug)}">Read Article</a>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<p class="empty-state">Unable to load blog posts.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadBlogPosts);
