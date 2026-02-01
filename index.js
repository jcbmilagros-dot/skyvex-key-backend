const express = require("express");
const fs = require("fs");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());

const FILE = "SkyvexKey.json";
const KEY_DURATION = 3600 * 1000; // 1 hora

// 🔔 TU WEBHOOK DE DISCORD
const DISCORD_WEBHOOK =
  "https://discord.com/api/webhooks/1467582702231228623/kz1P4OuPl7izmORfKT2WGjZ-yJU8c6Q9ts6PdcyqLVN46g0VpjUp0oN74V0cMK6qXIkB";

// ================== UTILS ==================
function loadDB() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE));
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

async function logDiscord(title, fields) {
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
  } catch {}
}

// ================== VERIFY ==================
app.post("/verify", async (req, res) => {
  const { key, user, userid } = req.body;
  if (!key) return res.json({ ok: false, error: "no_key" });

  const db = loadDB();
  const now = Date.now();

  // 🆕 PRIMER USO
  if (!db[key]) {
    db[key] = {
      start: now,
      expires: now + KEY_DURATION,
      revoked: false,
      uses: [],
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
  entry.uses.push({ user, userid, time: now });
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

// ================== REVOCAR ==================
app.post("/revoke", (req, res) => {
  const { key } = req.body;
  const db = loadDB();
  if (!db[key]) return res.json({ ok: false });

  db[key].revoked = true;
  saveDB(db);

  logDiscord("🛑 Key Revoked Manually", [{ name: "Key", value: key }]);
  res.json({ ok: true });
});

// ================== ROOT ==================
app.get("/", (req, res) => {
  res.send("Skyvex Key Server running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Skyvex Key Server running");
});
