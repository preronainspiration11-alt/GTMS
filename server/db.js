// Postgres storage (works with Supabase). Set DATABASE_URL in .env / Render.
const { Pool, types } = require("pg");
const bcrypt = require("bcryptjs");
const { ROUTE, DEPARTMENTS } = require("./lib/route");

types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10))); // bigint -> Number

const url = process.env.DATABASE_URL;
const useSSL = !!url && !/localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: useSSL ? { rejectUnauthorized: false } : false, max: 5 });
pool.on("error", (e) => console.error("Postgres pool error:", e.message));

const q = (text, params) => pool.query(text, params);

async function getSetting(key, fallback = null) {
  const { rows } = await q("SELECT value FROM settings WHERE key=$1", [key]);
  return rows.length ? rows[0].value : fallback;
}
async function setSetting(key, value) {
  await q("INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [key, String(value)]);
}

async function init() {
  if (!url) throw new Error("DATABASE_URL is not set. See SUPABASE.md.");
  await q(`
    CREATE TABLE IF NOT EXISTS checkpoints ( seq INTEGER NOT NULL, code TEXT PRIMARY KEY, name TEXT NOT NULL, dept TEXT NOT NULL );
    CREATE TABLE IF NOT EXISTS departments ( name TEXT PRIMARY KEY );
    CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT );
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shifts (
      id BIGSERIAL PRIMARY KEY, guard_name TEXT NOT NULL, face_img TEXT,
      started_at BIGINT NOT NULL, ended_at BIGINT, status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS scans (
      id BIGSERIAL PRIMARY KEY, shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      checkpoint_code TEXT NOT NULL, scanned_at BIGINT NOT NULL, UNIQUE (shift_id, checkpoint_code)
    );
    CREATE TABLE IF NOT EXISTS observations (
      id BIGSERIAL PRIMARY KEY, shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      checkpoint_code TEXT NOT NULL, category TEXT NOT NULL, dept TEXT NOT NULL,
      remarks TEXT, photo TEXT, status TEXT NOT NULL DEFAULT 'Open', created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS report_log (
      id BIGSERIAL PRIMARY KEY, shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      emailed_to TEXT, preview_url TEXT, emailed_at BIGINT NOT NULL, kind TEXT NOT NULL DEFAULT 'manual'
    );
  `);

  // reference data
  // Sync the checkpoint list to the current route: add new areas (e.g. the
  // segregated shop floor), refresh names/order, and drop retired points.
  // Existing rows keep their (possibly customised) department mapping.
  for (const c of ROUTE)
    await q(
      "INSERT INTO checkpoints (seq,code,name,dept) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO UPDATE SET seq=EXCLUDED.seq, name=EXCLUDED.name",
      [c.seq, c.code, c.name, c.dept]
    );
  await q("DELETE FROM checkpoints WHERE code <> ALL($1::text[])", [ROUTE.map((c) => c.code)]);
  for (const d of DEPARTMENTS)
    await q("INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [d]);

  if ((await getSetting("manager_email")) === null)
    await setSetting("manager_email", process.env.DEFAULT_MANAGER_EMAIL || "security.manager@company.com");
  if ((await getSetting("report_time")) === null)
    await setSetting("report_time", process.env.DEFAULT_REPORT_TIME || "07:00");

  // default users (change these!)
  const uc = await q("SELECT COUNT(*) n FROM users");
  if (Number(uc.rows[0].n) === 0) {
    const adminPw = process.env.ADMIN_PASSWORD || "gtms-admin";
    const guardPw = process.env.GUARD_PASSWORD || "gtms-guard";
    await q("INSERT INTO users (username,password_hash,role,name) VALUES ($1,$2,$3,$4)", ["admin", bcrypt.hashSync(adminPw, 10), "admin", "Security Manager"]);
    await q("INSERT INTO users (username,password_hash,role,name) VALUES ($1,$2,$3,$4)", ["guard", bcrypt.hashSync(guardPw, 10), "guard", "Security"]);
    console.log(`\n  Default logins created (change them!):\n    admin / ${adminPw}   (dashboard & reports)\n    guard / ${guardPw}   (patrol app)\n`);
  }
}

module.exports = { pool, q, init, getSetting, setSetting };
