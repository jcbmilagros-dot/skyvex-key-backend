// ================= ADMIN PANEL SCRIPT =================

// Leer token de la URL
const params = new URLSearchParams(window.location.search);
const token = params.get("token");

if (!token) {
  document.body.innerHTML = "<h2>Unauthorized</h2>";
  throw new Error("No admin token");
}

// Base correcta para el backend
const API_BASE = "/admin";

// Cargar keys
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

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${k.key}</td>
      <td>${min}m ${s}s</td>
      <td>${k.revoked ? "Revoked" : "Active"}</td>
      <td>${k.uses}</td>
      <td>
        <button class="red" onclick="revokeKey('${k.key}')">Revoke</button>
        <button onclick="extendKey('${k.key}', 600000)">+10m</button>
        <button onclick="extendKey('${k.key}', 3600000)">+1h</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Revocar key
async function revokeKey(key) {
  await fetch(`${API_BASE}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, token })
  });
  loadKeys();
}

// Extender tiempo
async function extendKey(key, ms) {
  await fetch(`${API_BASE}/extend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, ms, token })
  });
  loadKeys();
}

// Inicial
loadKeys();
setInterval(loadKeys, 5000);