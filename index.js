//==================================================
// CYPHERHUB | GLOBAL KEY BACKEND
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

const DISCORD_WEBHOOK = "PON_AQUI_TU_WEBHOOK";

const ADMIN_TOKEN = "cypherhub_super_admin_CAMBIA_ESTO";

// ================== IN-MEMORY DB ==================
const DB = {};

// ================== VERIFY ==================
app.post("/verify", async (req, res) => {
  const { key, user, userid } = req.body;
  if (!key) return res.json({ ok: false });

  const now = Date.now();

  if (!DB[key]) {
    DB[key] = {
      start: now,
      expires: now + KEY_DURATION,
      revoked: false,
      users: [],
    };
  }

  const entry = DB[key];

  if (entry.revoked)
    return res.json({ ok: false, error: "revoked" });

  if (now >= entry.expires)
    return res.json({ ok: false, error: "expired" });

  entry.users.push({ user, userid, time: now });

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

app.post("/admin/revoke", (req, res) => {
  const { key, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();
  if (DB[key]) DB[key].revoked = true;
  res.json({ ok: true });
});

app.post("/admin/extend", (req, res) => {
  const { key, ms, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();
  if (DB[key]) DB[key].expires += ms;
  res.json({ ok: true });
});

app.post("/admin/delete", (req, res) => {
  const { key, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();
  delete DB[key];
  res.json({ ok: true });
});

app.post("/admin/delete-all", (req, res) => {
  const { token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(403).end();
  Object.keys(DB).forEach(k => delete DB[k]);
  res.json({ ok: true });
});

// ================== PANEL ==================
app.use("/admin", express.static(path.join(__dirname, "admin")));

app.get("/", (_, res) => {
  res.send("Cypherhub Key Server running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Cypherhub Server running on port", PORT);
});