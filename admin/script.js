const params = new URLSearchParams(window.location.search);
const token = params.get("token");
if (!token) {
  document.body.innerHTML = "<h2>Unauthorized</h2>";
  throw new Error("No admin token");
}

const API_BASE = "/admin";
let currentFilter = "all";
let cachedKeys = [];

async function loadKeys() {
  const res = await fetch(`${API_BASE}/keys?token=${token}`);
  if (!res.ok) return;

  const keys = await res.json();
  cachedKeys = keys;
  renderKeys();
  updateStats();
}

function renderKeys() {
  const tbody = document.querySelector("#keys tbody");
  tbody.innerHTML = "";

  const now = Date.now();

  cachedKeys.forEach(k => {
    const expired = k.remaining <= 0;
    const active = !k.revoked && !expired;

    if (
      currentFilter === "active" && !active ||
      currentFilter === "revoked" && !k.revoked ||
      currentFilter === "expired" && !expired
    ) return;

    const sec = Math.floor(k.remaining / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${k.key}</td>
      <td>${expired ? "Expired" : `${min}m ${s}s`}</td>
      <td class="${active ? "status-active" : k.revoked ? "status-revoked" : "status-expired"}">
        ${active ? "Active" : k.revoked ? "Revoked" : "Expired"}
      </td>
      <td>${k.uses}</td>
      <td>
        <button onclick="extendKey('${k.key}', 600000)">+10m</button>
        <button onclick="extendKey('${k.key}', 3600000)">+1h</button>
        <button class="red" onclick="revokeKey('${k.key}')">Revoke</button>
        <button class="danger" onclick="deleteKey('${k.key}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateStats() {
  const total = cachedKeys.length;
  const active = cachedKeys.filter(k => !k.revoked && k.remaining > 0).length;
  const revoked = cachedKeys.filter(k => k.revoked).length;

  document.getElementById("totalKeys").innerText = total;
  document.getElementById("activeKeys").innerText = active;
  document.getElementById("revokedKeys").innerText = revoked;
}

function filterKeys(type) {
  currentFilter = type;
  renderKeys();
}

async function revokeKey(key) {
  await fetch(`${API_BASE}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, token })
  });
  loadKeys();
}

async function extendKey(key, ms) {
  await fetch(`${API_BASE}/extend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, ms, token })
  });
  loadKeys();
}

async function deleteKey(key) {
  await fetch(`${API_BASE}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, token })
  });
  loadKeys();
}

async function clearExpired() {
  const expired = cachedKeys.filter(k => k.remaining <= 0);
  for (const k of expired) {
    await deleteKey(k.key);
  }
  loadKeys();
}

loadKeys();
setInterval(loadKeys, 5000);