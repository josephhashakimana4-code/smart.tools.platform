const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "admin.json");

function loadAdminConfig() {
  if (process.env.NODE_ENV === "test") {
    return {};
  }

  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }

    const raw = fs.readFileSync(configPath, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Failed to load admin config:", err.message);
    return {};
  }
}

function saveAdminConfig(config) {
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    return config;
  } catch (err) {
    console.error("Failed to save admin config:", err.message);
    return null;
  }
}

module.exports = {
  loadAdminConfig,
  saveAdminConfig,
  configPath
};
