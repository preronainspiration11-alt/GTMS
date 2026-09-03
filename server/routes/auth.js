const express = require("express");
const { q } = require("../db");
const { sign, checkPassword, requireAuth } = require("../auth");
const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const { rows } = await q("SELECT * FROM users WHERE username=$1", [String(username).trim().toLowerCase()]);
    const u = rows[0];
    if (!u || !(await checkPassword(password, u.password_hash)))
      return res.status(401).json({ error: "Invalid username or password" });
    res.json({ token: sign(u), user: { name: u.name, role: u.role, username: u.username } });
  } catch (e) { next(e); }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ name: req.user.name, role: req.user.role, username: req.user.username });
});

module.exports = router;
