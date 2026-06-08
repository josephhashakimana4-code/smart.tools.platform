async function getTools() {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/tools`);
    if (!res.ok) throw new Error("Failed to fetch tools");
    return await res.json();
  } catch (err) {
    console.error("API Error:", err);
    return [];
  }
}