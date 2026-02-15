//==================================================
// CYPHERHUB | GLOBAL KEY BACKEND + DISCORD LOGS
//==================================================

import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

// ================== SETUP ==================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const KEY_DURATION = 3600 * 1000; // 1 hora

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1472726706459639970/brCiOzwTeopW2vfO2bUMS4P97chjP8TC9Oq3QTS7dkHEVdF77uxIuxwwJuHrR2uvdSN5";

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
  } catch (err) {
    console.error("Webhook error:", err);
  }
}

// ================== VERIFY ==================
app.post("/verify", async (req, res) => {
  const { key, user, userid } = req.body;
  if (!key) return res.json({ ok: false });

  const now = Date.now();

  // Activación
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

  if (entry.revoked) {
    await logDiscord("🛑 Attempted Use of Revoked Key", [
      { name: "Key", value: key },
      { name: "User", value: `${user} (${userid})` },
    ]);
    return res.json({ ok: false, error: "revoked" });
  }

  if (now >= entry.expires) {
    await logDiscord("⌛ Cypherhub Key Expired Attempt", [
      { name: "Key", value: key },
      { name: "User", value: `${user} (${userid})` },
    ]);
    return res.json({ ok: false, error: "expired" });
  }

  entry.users.push({ user, userid, time: now });

  await logDiscord("📥 Cypherhub Key Used", [
    { name: "Key", value: key },
    { name: "User", value: `${user} (${userid})` },
    { name: "Remaining", value: formatTime(entry.expires - now) },
  ]);

  res.json({
    ok: true,
    remaining: entry.expires - now,
  });
});

// ================== ADMIN ==================

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

// REVOCAR
app.post("/admin/revoke", async (req, res) => {
  const { key, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();

  if (DB[key]) {
    DB[key].revoked = true;

    await logDiscord("🛑 Cypherhub Key Revoked", [
      { name: "Key", value: key },
    ]);
  }

  res.json({ ok: true });
});

// EXTENDER
app.post("/admin/extend", async (req, res) => {
  const { key, ms, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();

  if (DB[key]) {
    DB[key].expires += ms;

    await logDiscord("⏱ Cypherhub Key Extended", [
      { name: "Key", value: key },
      { name: "Added Time", value: formatTime(ms) },
    ]);
  }

  res.json({ ok: true });
});

// DELETE INDIVIDUAL
app.post("/admin/delete", async (req, res) => {
  const { key, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();

  if (DB[key]) {
    delete DB[key];

    await logDiscord("🗑️ Cypherhub Key Deleted", [
      { name: "Key", value: key },
    ]);
  }

  res.json({ ok: true });
});

// DELETE ALL
app.post("/admin/delete-all", async (req, res) => {
  const { token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();

  const total = Object.keys(DB).length;
  Object.keys(DB).forEach(k => delete DB[k]);

  await logDiscord("💣 Cypherhub ALL Keys Deleted", [
    { name: "Total Deleted", value: total.toString() },
  ]);

  res.json({ ok: true });
});

// ================== PANEL ==================
app.use("/admin", express.static(path.join(__dirname, "admin")));

app.get("/", (_, res) => {
  res.send("Cypherhub Key Server running");
});

// ================== START ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Cypherhub Server running on port", PORT);
});