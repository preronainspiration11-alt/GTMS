const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
if (!process.env.JWT_SECRET) console.warn("⚠  JWT_SECRET not set — using an insecure default. Set JWT_SECRET in production.");

const sign = (u) => jwt.sign({ sub: u.id, role: u.role, name: u.name, username: u.username }, SECRET, { expiresIn: "12h" });
const verify = (t) => jwt.verify(t, SECRET);

function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tok) return res.status(401).json({ error: "Login required" });
  try { req.user = verify(tok); next(); }
  catch (e) { res.status(401).json({ error: "Session expired — sign in again" }); }
}
function requireRole(role) {
  return (req, res, next) => (req.user && req.user.role === role) ? next() : res.status(403).json({ error: "Not allowed" });
}
const checkPassword = (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { sign, verify, requireAuth, requireRole, checkPassword };
