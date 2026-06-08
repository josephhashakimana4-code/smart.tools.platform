function renderTools(tools) {
  const container = document.getElementById("toolsContainer");
  container.innerHTML = "";

  tools.forEach(tool => {
    const card = document.createElement("div");
    card.className = "tool-card";

    const title = document.createElement("h3");
    title.textContent = tool.name;

    const category = document.createElement("p");
    category.textContent = tool.category;

    const btn = document.createElement("button");
    btn.textContent = "Use Tool";
    btn.className = "tool-btn";

    btn.addEventListener("click", () => {
      openTool(tool.slug);
    });

    card.appendChild(title);
    card.appendChild(category);
    card.appendChild(btn);

    container.appendChild(card);
  });
}

// ✅ NAVIGATION FUNCTION
function openTool(slug) {
  window.location.href = `tool.html?tool=${slug}`;
}

// ✅ MAKE IT GLOBAL (important)
window.openTool = openTool;