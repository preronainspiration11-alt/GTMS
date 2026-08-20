// Report emailing: shared by the manual "send now" endpoint and the daily cron.
const { q, getSetting, setSetting } = require("./db");
const { buildReport } = require("./lib/report");
const { sendMail } = require("./mailer");

async function loadShiftDetail(id) {
  const { rows } = await q("SELECT * FROM shifts WHERE id=$1", [id]);
  const row = rows[0];
  if (!row) return null;
  const scans = (await q("SELECT checkpoint_code AS code, scanned_at AS ts FROM scans WHERE shift_id=$1 ORDER BY scanned_at", [id])).rows;
  const observations = (await q("SELECT * FROM observations WHERE shift_id=$1 ORDER BY created_at", [id])).rows
    .map((o) => ({ id: o.id, checkpoint: o.checkpoint_code, category: o.category, dept: o.dept, remarks: o.remarks, photo: o.photo, status: o.status, ts: o.created_at }));
  return {
    id: row.id, guard: row.guard_name, faceImg: row.face_img,
    startedAt: row.started_at, endedAt: row.ended_at, status: row.status,
    scans, observations,
  };
}

async function emailShiftReport(id, { baseUrl = "", kind = "manual" } = {}) {
  const shift = await loadShiftDetail(id);
  if (!shift) throw new Error("Shift not found");
  const to = await getSetting("manager_email");
  const { subject, html, text } = buildReport(shift, baseUrl);
  const res = await sendMail({ to, subject, html, text });
  await q("INSERT INTO report_log (shift_id, emailed_to, preview_url, emailed_at, kind) VALUES ($1,$2,$3,$4,$5)",
    [id, to, res.preview, Date.now(), kind]);
  return { to, preview: res.preview, mode: res.mode };
}

// Every minute: at the configured time, email yesterday's completed patrols once.
async function dailyTick(baseUrl = "") {
  const time = await getSetting("report_time", "07:00");
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);
  if (hhmm !== time) return;
  if ((await getSetting("last_daily_run")) === today) return;
  await setSetting("last_daily_run", today);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = (await q(`
    SELECT s.id FROM shifts s
    WHERE s.ended_at IS NOT NULL AND s.ended_at < $1
      AND NOT EXISTS (SELECT 1 FROM report_log r WHERE r.shift_id = s.id AND r.kind = 'daily')
  `, [startOfToday])).rows;

  for (const { id } of due) {
    try { await emailShiftReport(id, { baseUrl, kind: "daily" }); }
    catch (e) { console.error("Daily report failed for shift", id, e.message); }
  }
  if (due.length) console.log(`Daily job emailed ${due.length} patrol report(s).`);
}

module.exports = { emailShiftReport, dailyTick, loadShiftDetail };
