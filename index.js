//==================================================
// CYPHERHUB | GLOBAL KEY BACKEND
// - Tiempo global real por key
// - Compartir key NO reinicia tiempo
// - Logs a Discord
// - Panel web admin funcional
//==================================================

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// ================== SETUP ==================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const KEY_DURATION = 3600 * 1000; // 1 hora

const DISCORD_WEBHOOK =
  "https://discord.com/api/webhooks/1472726706459639970/brCiOzwTeopW2vfO2bUMS4P97chjP8TC9Oq3QTS7dkHEVdF77uxIuxwwJuHrR2uvdSN5";

const ADMIN_TOKEN = "cypherhub_super_admin_CAMBIA_ESTO";

// ================== IN-MEMORY DB ==================
const DB = {};

// ================== UTILS ==================
function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

// ================== DISCORD LOG ==================
async function logDiscord(title, fields = []) {
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
  } catch {}
}

// ================== VERIFY ==================
app.post("/verify", async (req, res) => {
  const { key, user, userid } = req.body;
  if (!key) return res.json({ ok: false });

  const now = Date.now();

  // PRIMER USO → ARRANCA RELOJ GLOBAL
  if (!DB[key]) {
    DB[key] = {
      start: now,
      expires: now + KEY_DURATION,
      revoked: false,
      users: [],
    };

    await logDiscord("🔑 Cypherhub Key Activated", [
      { name: "Key", value: key },
      { name: "User", value: `${user} (${userid})` },
      { name: "Duration", value: "1 hour" },
    ]);
  }

  const entry = DB[key];

  if (entry.revoked)
    return res.json({ ok: false, error: "revoked" });

  if (now >= entry.expires) {
    await logDiscord("⌛ Cypherhub Key Expired", [
      { name: "Key", value: key },
    ]);
    return res.json({ ok: false, error: "expired" });
  }

  const remaining = entry.expires - now;
  entry.users.push({ user, userid, time: now });

  await logDiscord("📥 Cypherhub Key Used", [
    { name: "Key", value: key },
    { name: "User", value: `${user} (${userid})` },
    { name: "Remaining", value: formatTime(remaining) },
  ]);

  res.json({
    ok: true,
    remaining,
  });
});

// ================== ADMIN API ==================
app.get("/admin/keys", (req, res) => {
  if (req.query.token !== ADMIN_TOKEN)
    return res.status(403).json([]);

  const now = Date.now();

  const result = Object.entries(DB).map(([key, data]) => ({
    key,
    revoked: data.revoked,
    remaining: Math.max(0, data.expires - now),
    uses: data.users.length,
  }));

  res.json(result);
});

app.post("/admin/revoke", (req, res) => {
  const { key, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();

  if (!DB[key]) return res.json({ ok: false });

  DB[key].revoked = true;

  logDiscord("🛑 Cypherhub Key Revoked Manually", [
    { name: "Key", value: key },
  ]);

  res.json({ ok: true });
});

app.post("/admin/extend", (req, res) => {
  const { key, ms, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();

  if (!DB[key]) return res.json({ ok: false });

  DB[key].expires += ms;

  logDiscord("⏱️ Cypherhub Key Extended", [
    { name: "Key", value: key },
    { name: "Added", value: formatTime(ms) },
  ]);

  res.json({ ok: true });
});

// ================== ADMIN PANEL ==================
app.use("/admin", express.static(path.join(__dirname, "admin")));

// ================== ROOT ==================
app.get("/", (_, res) => {
  res.send("Cypherhub Key Server running");
});

// ================== START ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Cypherhub Key Server running on port", PORT);
});