const express = require("express");
const { q } = require("../db");
const { saveDataUrl } = require("../lib/images");
const { ROUTE } = require("../lib/route");
const { emailShiftReport, loadShiftDetail } = require("../jobs");
const router = express.Router();

const baseUrl = (req) => `${req.protocol}://${req.get("host")}`;

router.get("/active", async (req, res, next) => {
  try {
    const { rows } = await q("SELECT id FROM shifts WHERE status='active' ORDER BY started_at DESC LIMIT 1");
    res.json(rows.length ? await loadShiftDetail(rows[0].id) : null);
  } catch (e) { next(e); }
});

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await q(`
      SELECT s.*,
        (SELECT COUNT(*) FROM scans WHERE shift_id=s.id) AS scanned,
        (SELECT COUNT(*) FROM observations WHERE shift_id=s.id) AS obs
      FROM shifts s WHERE status='ended' ORDER BY ended_at DESC`);
    res.json(rows.map((r) => ({
      id: r.id, guard: r.guard_name, faceImg: r.face_img,
      startedAt: r.started_at, endedAt: r.ended_at,
      scannedCount: r.scanned, obsCount: r.obs, total: ROUTE.length,
    })));
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const s = await loadShiftDetail(req.params.id);
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(s);
  } catch (e) { next(e); }
});

// start a patrol — guard face verification (requirement 3)
router.post("/", async (req, res, next) => {
  try {
    const { guardName, faceImg } = req.body || {};
    if (!guardName || !guardName.trim()) return res.status(400).json({ error: "guardName is required" });
    await q("UPDATE shifts SET status='ended', ended_at=$1 WHERE status='active'", [Date.now()]);
    const { rows } = await q(
      "INSERT INTO shifts (guard_name, face_img, started_at, status) VALUES ($1,$2,$3,'active') RETURNING id",
      [guardName.trim(), saveDataUrl(faceImg), Date.now()]
    );
    res.status(201).json(await loadShiftDetail(rows[0].id));
  } catch (e) { next(e); }
});

// scan a checkpoint — auto-records date/time/location (requirement 4)
router.post("/:id/scan", async (req, res, next) => {
  try {
    const { code } = req.body || {};
    if (!ROUTE.find((c) => c.code === code)) return res.status(400).json({ error: "Unknown checkpoint code" });
    const { rows } = await q("SELECT id FROM shifts WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Shift not found" });
    await q("INSERT INTO scans (shift_id, checkpoint_code, scanned_at) VALUES ($1,$2,$3) ON CONFLICT (shift_id, checkpoint_code) DO NOTHING",
      [req.params.id, code, Date.now()]);
    res.json(await loadShiftDetail(req.params.id));
  } catch (e) { next(e); }
});

router.post("/:id/end", async (req, res, next) => {
  try {
    const { rows } = await q("SELECT id FROM shifts WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Shift not found" });
    await q("UPDATE shifts SET status='ended', ended_at=$1 WHERE id=$2", [Date.now(), req.params.id]);
    res.json(await loadShiftDetail(req.params.id));
  } catch (e) { next(e); }
});

// email this patrol's report now (requirement 6, on-demand)
router.post("/:id/email", async (req, res, next) => {
  try {
    res.json(await emailShiftReport(req.params.id, { baseUrl: baseUrl(req), kind: "manual" }));
  } catch (e) { next(e); }
});

module.exports = router;
