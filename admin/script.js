const params = new URLSearchParams(window.location.search);
const token = params.get("token");

if (!token) {
  document.body.innerHTML = "<h2>Unauthorized</h2>";
  throw new Error("No admin token");
}

const API_BASE = "/admin";

async function loadKeys() {
  const res = await fetch(`${API_BASE}/keys?token=${token}`);
  const keys = await res.json();

  const tbody = document.getElementById("keysBody");
  tbody.innerHTML = "";

  let active = 0;
  let revoked = 0;

  keys.forEach(k => {
    const tr = document.createElement("tr");

    const sec = Math.floor(k.remaining / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;

    const statusText = k.revoked
      ? "Revoked"
      : (k.remaining <= 0 ? "Expired" : "Active");

    if (statusText === "Active") active++;
    if (statusText === "Revoked") revoked++;

    tr.innerHTML = `
      <td>${k.key}</td>
      <td>${min}m ${s}s</td>
      <td class="status-${statusText.toLowerCase()}">${statusText}</td>
      <td>${k.uses}</td>
      <td>
        <button class="btn-revoke" onclick="revokeKey('${k.key}')">Revoke</button>
        <button class="btn-extend" onclick="extendKey('${k.key}', 600000)">+10m</button>
        <button class="btn-delete" onclick="deleteKey('${k.key}')">Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("totalKeys").textContent = keys.length;
  document.getElementById("activeKeys").textContent = active;
  document.getElementById("revokedKeys").textContent = revoked;
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
  if (!confirm("Are you sure you want to DELETE this key permanently?"))
    return;

  await fetch(`${API_BASE}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, token })
  });

  loadKeys();
}

loadKeys();
setInterval(loadKeys, 5000);