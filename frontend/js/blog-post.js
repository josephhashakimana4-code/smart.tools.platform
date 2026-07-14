const BLOG_POST_API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderArticle(content) {
  return escapeHTML(content)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function upsertMetaTag(name, attrs) {
  let tag = document.head.querySelector(name);
  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }
  Object.entries(attrs).forEach(([key, value]) => tag.setAttribute(key, value));
}

async function loadBlogPost() {
  const slug = window.location.pathname.split("/").filter(Boolean).pop();
  const title = document.getElementById("postTitle");
  const excerpt = document.getElementById("postExcerpt");
  const content = document.getElementById("postContent");

  try {
    const res = await fetch(`${BLOG_POST_API_BASE}/api/blog/${encodeURIComponent(slug)}`);
    const post = await res.json();
    if (!res.ok) throw new Error(post.message || "Post not found.");

    const pageTitle = post.metaTitle || `${post.title} | Smart Tools Hub`;
    const pageDescription = post.metaDescription || post.excerpt || "";
    document.title = pageTitle;
    title.textContent = post.title;
    excerpt.textContent = pageDescription;
    content.innerHTML = renderArticle(post.content || post.excerpt || "");

    upsertMetaTag('meta[name="description"]', { name: "description", content: pageDescription });
    upsertMetaTag('meta[property="og:title"]', { property: "og:title", content: pageTitle });
    upsertMetaTag('meta[property="og:description"]', { property: "og:description", content: pageDescription });
    upsertMetaTag('meta[property="og:type"]', { property: "og:type", content: "article" });
    upsertMetaTag('meta[property="og:url"]', { property: "og:url", content: `${window.location.origin}${window.location.pathname}` });
    upsertMetaTag('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}${window.location.pathname}`;
  } catch (err) {
    const fallbackTitle = "Article Not Found | Smart Tools Hub";
    document.title = fallbackTitle;
    title.textContent = "Article Not Found";
    excerpt.textContent = "";
    content.innerHTML = `<p>${escapeHTML(err.message)}</p>`;
    upsertMetaTag('meta[name="description"]', { name: "description", content: "Read Smart Tools Hub guides and business articles." });
    upsertMetaTag('meta[property="og:title"]', { property: "og:title", content: fallbackTitle });
    upsertMetaTag('meta[property="og:description"]', { property: "og:description", content: "Read Smart Tools Hub guides and business articles." });
  }
}

document.addEventListener("DOMContentLoaded", loadBlogPost);
