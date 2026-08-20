const express = require("express");
const { q, getSetting, setSetting } = require("../db");
const { CATEGORIES } = require("../lib/route");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const checkpoints = (await q("SELECT seq, code, name, dept FROM checkpoints ORDER BY seq")).rows;
    const departments = (await q("SELECT name FROM departments ORDER BY name")).rows.map((d) => d.name);
    res.json({
      checkpoints, departments, categories: CATEGORIES,
      settings: { managerEmail: await getSetting("manager_email"), reportTime: await getSetting("report_time") },
    });
  } catch (e) { next(e); }
});

router.put("/settings", async (req, res, next) => {
  try {
    const { managerEmail, reportTime } = req.body || {};
    if (managerEmail) await setSetting("manager_email", managerEmail);
    if (reportTime) await setSetting("report_time", reportTime);
    res.json({ managerEmail: await getSetting("manager_email"), reportTime: await getSetting("report_time") });
  } catch (e) { next(e); }
});

router.put("/checkpoints/:code", async (req, res, next) => {
  try {
    const { dept } = req.body || {};
    const r = await q("UPDATE checkpoints SET dept=$1 WHERE code=$2", [dept, req.params.code]);
    if (!r.rowCount) return res.status(404).json({ error: "Unknown checkpoint" });
    res.json({ code: req.params.code, dept });
  } catch (e) { next(e); }
});

module.exports = router;
