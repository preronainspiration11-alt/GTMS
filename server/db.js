// Postgres storage (works with Supabase). Set DATABASE_URL in .env / Render.
// Tables are created automatically on first run. Timestamps are epoch-ms bigints;
// we parse bigint -> JS number so the app and front-end use plain numbers.
const { Pool, types } = require("pg");
const { ROUTE, DEPARTMENTS } = require("./lib/route");

// bigint (int8, OID 20) -> Number  (our ids/timestamps are well within range)
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const url = process.env.DATABASE_URL;
const useSSL = !!url && !/localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({
  connectionString: url,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 5,
});
pool.on("error", (e) => console.error("Postgres pool error:", e.message));

const q = (text, params) => pool.query(text, params);

async function getSetting(key, fallback = null) {
  const { rows } = await q("SELECT value FROM settings WHERE key=$1", [key]);
  return rows.length ? rows[0].value : fallback;
}
async function setSetting(key, value) {
  await q(
    "INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
    [key, String(value)]
  );
}

async function init() {
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Create a Supabase project and put its connection string in .env (see SUPABASE.md)."
    );
  }
  await q(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      seq  INTEGER NOT NULL,
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dept TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS departments ( name TEXT PRIMARY KEY );
    CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT );
    CREATE TABLE IF NOT EXISTS shifts (
      id         BIGSERIAL PRIMARY KEY,
      guard_name TEXT NOT NULL,
      face_img   TEXT,
      started_at BIGINT NOT NULL,
      ended_at   BIGINT,
      status     TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS scans (
      id              BIGSERIAL PRIMARY KEY,
      shift_id        BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      checkpoint_code TEXT NOT NULL,
      scanned_at      BIGINT NOT NULL,
      UNIQUE (shift_id, checkpoint_code)
    );
    CREATE TABLE IF NOT EXISTS observations (
      id              BIGSERIAL PRIMARY KEY,
      shift_id        BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      checkpoint_code TEXT NOT NULL,
      category        TEXT NOT NULL,
      dept            TEXT NOT NULL,
      remarks         TEXT,
      photo           TEXT,
      status          TEXT NOT NULL DEFAULT 'Open',
      created_at      BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS report_log (
      id          BIGSERIAL PRIMARY KEY,
      shift_id    BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      emailed_to  TEXT,
      preview_url TEXT,
      emailed_at  BIGINT NOT NULL,
      kind        TEXT NOT NULL DEFAULT 'manual'
    );
  `);

  const { rows } = await q("SELECT COUNT(*) n FROM checkpoints");
  if (Number(rows[0].n) === 0) {
    for (const c of ROUTE)
      await q("INSERT INTO checkpoints (seq,code,name,dept) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING",
        [c.seq, c.code, c.name, c.dept]);
  }
  for (const d of DEPARTMENTS)
    await q("INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [d]);

  if ((await getSetting("manager_email")) === null)
    await setSetting("manager_email", process.env.DEFAULT_MANAGER_EMAIL || "security.manager@company.com");
  if ((await getSetting("report_time")) === null)
    await setSetting("report_time", process.env.DEFAULT_REPORT_TIME || "07:00");
}

module.exports = { pool, q, init, getSetting, setSetting };
