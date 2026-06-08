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

async function loadBlogPost() {
  const slug = window.location.pathname.split("/").filter(Boolean).pop();
  const title = document.getElementById("postTitle");
  const excerpt = document.getElementById("postExcerpt");
  const content = document.getElementById("postContent");

  try {
    const res = await fetch(`${BLOG_POST_API_BASE}/api/blog/${encodeURIComponent(slug)}`);
    const post = await res.json();
    if (!res.ok) throw new Error(post.message || "Post not found.");

    document.title = post.metaTitle || `${post.title} | Smart Tools Hub`;
    title.textContent = post.title;
    excerpt.textContent = post.excerpt || post.metaDescription || "";
    content.innerHTML = renderArticle(post.content || post.excerpt || "");

    let description = document.head.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = post.metaDescription || post.excerpt || "";
  } catch (err) {
    title.textContent = "Article Not Found";
    excerpt.textContent = "";
    content.innerHTML = `<p>${escapeHTML(err.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadBlogPost);
