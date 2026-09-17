require("dotenv").config();
const path = require("path");
const express = require("express");
const cron = require("node-cron");

const { init } = require("./db");
const { dailyTick } = require("./jobs");
const { requireAuth } = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now() }));
app.use("/api/auth", require("./routes/auth"));            // public (login)
app.use("/api/config", requireAuth, require("./routes/config"));
app.use("/api/shifts", requireAuth, require("./routes/shifts"));
app.use("/api/observations", requireAuth, require("./routes/observations"));

app.use(express.static(path.join(__dirname, "..", "public")));

// Serve the QR-scanner and spreadsheet libraries from our own server (no CDN),
// so scanning/export work even on networks that block third-party CDNs.
app.use("/vendor/jsqr", express.static(path.join(__dirname, "..", "node_modules", "jsqr", "dist")));
app.use("/vendor/xlsx", express.static(path.join(__dirname, "..", "node_modules", "xlsx", "dist")));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message || "Server error" }); });

(async function start() {
  try { await init(); }
  catch (e) { console.error("\n❌ Could not initialise the database:\n   " + e.message + "\n"); process.exit(1); }

  cron.schedule("* * * * *", () => dailyTick(`http://localhost:${PORT}`).catch((e) => console.error("dailyTick error:", e.message)));

  app.listen(PORT, () => {
    console.log("\n  GTMS — Guard Tour Management System");
    console.log(`   ▸ App:  http://localhost:${PORT}`);
    console.log(`   ▸ DB:   Postgres (Supabase) via DATABASE_URL`);
    console.log("   ▸ Daily report scheduler running.\n");
  });
})();
