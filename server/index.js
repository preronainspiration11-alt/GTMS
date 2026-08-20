require("dotenv").config();
const path = require("path");
const express = require("express");
const cron = require("node-cron");

const { init } = require("./db");
const { dailyTick } = require("./jobs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "12mb" }));            // base64 images travel as JSON
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

app.use("/api/config", require("./routes/config"));
app.use("/api/shifts", require("./routes/shifts"));
app.use("/api/observations", require("./routes/observations"));
app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now() }));

app.use(express.static(path.join(__dirname, "..", "public")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

(async function start() {
  try {
    await init(); // create tables + seed reference data on the Postgres database
  } catch (e) {
    console.error("\n❌ Could not initialise the database:\n   " + e.message + "\n");
    process.exit(1);
  }

  cron.schedule("* * * * *", () => {
    dailyTick(`http://localhost:${PORT}`).catch((e) => console.error("dailyTick error:", e.message));
  });

  app.listen(PORT, () => {
    console.log("\n  GTMS — Guard Tour Management System");
    console.log(`   ▸ App:  http://localhost:${PORT}`);
    console.log(`   ▸ DB:   Postgres (Supabase) via DATABASE_URL`);
    console.log("   ▸ Daily report scheduler running.\n");
  });
})();
