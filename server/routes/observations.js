const express = require("express");
const { q } = require("../db");
const { saveDataUrl } = require("../lib/images");
const router = express.Router();

const map = (o) => ({
  id: o.id, shiftId: o.shift_id, checkpoint: o.checkpoint_code,
  category: o.category, dept: o.dept, remarks: o.remarks,
  photo: o.photo, status: o.status, ts: o.created_at,
});

router.get("/", async (req, res, next) => {
  try {
    const { dept, status } = req.query;
    const where = [], args = [];
    if (dept) { args.push(dept); where.push(`dept=$${args.length}`); }
    if (status) { args.push(status); where.push(`status=$${args.length}`); }
    const sql = "SELECT * FROM observations" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY created_at DESC";
    res.json((await q(sql, args)).rows.map(map));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const { shiftId, checkpoint, category, dept, remarks, photo } = req.body || {};
    if (!shiftId || !checkpoint || !category || !dept)
      return res.status(400).json({ error: "shiftId, checkpoint, category and dept are required" });
    const { rows } = await q(
      "INSERT INTO observations (shift_id, checkpoint_code, category, dept, remarks, photo, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,'Open',$7) RETURNING *",
      [shiftId, checkpoint, category, dept, remarks || "", saveDataUrl(photo), Date.now()]
    );
    res.status(201).json(map(rows[0]));
  } catch (e) { next(e); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!["Open", "Acknowledged", "Resolved"].includes(status))
      return res.status(400).json({ error: "Invalid status" });
    const { rows, rowCount } = await q("UPDATE observations SET status=$1 WHERE id=$2 RETURNING *", [status, req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    res.json(map(rows[0]));
  } catch (e) { next(e); }
});

module.exports = router;
