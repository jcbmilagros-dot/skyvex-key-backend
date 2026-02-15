// ================= CYPHERHUB ADMIN PANEL SCRIPT =================

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

if (!token) {
  document.body.innerHTML = "<h2>Unauthorized</h2>";
  throw new Error("No admin token");
}

const API_BASE = "/admin";

async function loadKeys() {
  const res = await fetch(`${API_BASE}/keys?token=${token}`);

  if (!res.ok) {
    console.error("Failed to load keys");
    return;
  }

  const keys = await res.json();
  const tbody = document.querySelector("#keys tbody");
  tbody.innerHTML = "";

  keys.forEach(k => {
    const sec = Math.floor(k.remaining / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    const expired = k.remaining <= 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${k.key}</td>
      <td>${expired ? "Expired" : `${min}m ${s}s`}</td>
      <td>${k.revoked ? "Revoked" : expired ? "Expired" : "Active"}</td>
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
  if (!confirm("Delete this key permanently?")) return;

  await fetch(`${API_BASE}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, token })
  });
  loadKeys();
}

async function deleteAll() {
  if (!confirm("DELETE ALL KEYS? This cannot be undone.")) return;

  await fetch(`${API_BASE}/delete-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  loadKeys();
}

loadKeys();
setInterval(loadKeys, 5000);