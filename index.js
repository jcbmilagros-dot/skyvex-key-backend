//==================================================
// SKYVEX HUB | GLOBAL KEY BACKEND (FINAL)
// - Tiempo global real por key
// - Compartir key NO reinicia tiempo
// - Logs a Discord
// - Panel web admin
//==================================================

import express from "express";
import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

// ================== SETUP ==================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const FILE = "SkyvexKey.json";
const KEY_DURATION = 3600 * 1000; // 1 hora

// 🔔 DISCORD WEBHOOK (SOLO AQUÍ)
const DISCORD_WEBHOOK =
  "https://discord.com/api/webhooks/1467582702231228623/kz1P4OuPl7izmORfKT2WGjZ-yJU8c6Q9ts6PdcyqLVN46g0VpjUp0oN74V0cMK6qXIkB";

// 🔐 TOKEN ADMIN (CAMBIA ESTO)
const ADMIN_TOKEN = "skyvex_super_admin_CAMBIA_ESTO";

// ================== DB UTILS ==================
function loadDB() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

// ================== DISCORD LOG ==================
async function logDiscord(title, fields = []) {
  if (!DISCORD_WEBHOOK) return;

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title,
            color: 0x5865f2,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (e) {
    console.error("Discord log error:", e.message);
  }
}

// ================== VERIFY KEY (ROBLOX) ==================
app.post("/verify", async (req, res) => {
  const { key, user, userid } = req.body;
  if (!key) return res.json({ ok: false, error: "no_key" });

  const db = loadDB();
  const now = Date.now();

  // 🆕 PRIMER USO → ARRANCA RELOJ GLOBAL
  if (!db[key]) {
    db[key] = {
      start: now,
      expires: now + KEY_DURATION,
      revoked: false,
      users: [],
    };
    saveDB(db);

    await logDiscord("🔑 Key Activated", [
      { name: "Key", value: key },
      { name: "User", value: `${user} (${userid})` },
      { name: "Expires In", value: formatTime(KEY_DURATION) },
    ]);
  }

  const entry = db[key];

  // ⛔ REVOCADA
  if (entry.revoked) {
    await logDiscord("⛔ Key Revoked Attempt", [
      { name: "Key", value: key },
      { name: "User", value: `${user} (${userid})` },
    ]);
    return res.json({ ok: false, error: "revoked" });
  }

  // ⌛ EXPIRADA
  if (now >= entry.expires) {
    await logDiscord("⌛ Key Expired", [{ name: "Key", value: key }]);
    return res.json({ ok: false, error: "expired" });
  }

  // ✅ USO NORMAL
  const remaining = entry.expires - now;
  entry.users.push({ user, userid, time: now });
  saveDB(db);

  await logDiscord("📥 Key Used", [
    { name: "Key", value: key },
    { name: "User", value: `${user} (${userid})` },
    { name: "Time Remaining", value: formatTime(remaining) },
  ]);

  return res.json({
    ok: true,
    remaining,
  });
});

// ================== ADMIN API ==================

// 🔍 LISTAR KEYS
app.get("/admin/keys", (req, res) => {
  if (req.query.token !== ADMIN_TOKEN)
    return res.status(403).json({ error: "unauthorized" });

  const db = loadDB();
  const now = Date.now();

  const result = Object.entries(db).map(([key, data]) => ({
    key,
    revoked: data.revoked,
    expires: data.expires,
    remaining: Math.max(0, data.expires - now),
    uses: data.users.length,
  }));

  res.json(result);
});

// ⛔ REVOCAR KEY
app.post("/admin/revoke", (req, res) => {
  const { key, token } = req.body;
  if (token !== ADMIN_TOKEN)
    return res.status(403).json({ error: "unauthorized" });

  const db = loadDB();
  if (!db[key]) return res.json({ ok: false });

  db[key].revoked = true;
  saveDB(db);

  logDiscord("🛑 Key Revoked Manually", [{ name: "Key", value: key }]);
  res.json({ ok: true });
});

// ➕ EXTENDER TIEMPO
app.post("/admin/extend", (req, res) => {
  const { key, ms, token } = req.body;
  if (token !== ADMIN_TOKEN)
    return res.status(403).json({ error: "unauthorized" });

  const db = loadDB();
  if (!db[key]) return res.json({ ok: false });

  db[key].expires += ms;
  saveDB(db);

  logDiscord("⏱️ Key Extended", [
    { name: "Key", value: key },
    { name: "Added Time", value: formatTime(ms) },
  ]);

  res.json({ ok: true });
});

// ================== ADMIN PANEL (WEB) ==================
app.use("/admin", express.static(path.join(__dirname, "admin")));

// ================== ROOT ==================
app.get("/", (req, res) => {
  res.send("Skyvex Key Server running");
});

// ================== START ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Skyvex Key Server running on port", PORT);
});