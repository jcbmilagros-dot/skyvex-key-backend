const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const FILE = "SkyvexKey.json";
const KEY_DURATION = 3600 * 1000; // 1 hora

function loadDB() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE));
}

function saveDB(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

app.post("/verify", (req, res) => {
  const { key, user, userid } = req.body;
  if (!key) return res.json({ ok: false, error: "no_key" });

  const db = loadDB();
  const now = Date.now();

  // Primera vez que se usa la key → arranca el reloj global
  if (!db[key]) {
    db[key] = {
      key,
      first_used: now,
      expires: now + KEY_DURATION,
      revoked: false,
      uses: [{ user, userid, time: now }]
    };
    saveDB(db);
    return res.json({ ok: true, expires: db[key].expires });
  }

  const entry = db[key];

  if (entry.revoked) return res.json({ ok: false, error: "revoked" });
  if (now >= entry.expires) return res.json({ ok: false, error: "expired" });

  entry.uses.push({ user, userid, time: now });
  saveDB(db);

  return res.json({ ok: true, expires: entry.expires });
});

app.get("/", (req, res) => {
  res.send("Skyvex Key Server running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Skyvex Key Server running on port", PORT);
});
