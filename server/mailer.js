// Email transport. Uses your SMTP settings when provided; otherwise falls back
// to an auto-created Ethereal test inbox and returns a preview URL so email
// "works" out of the box without any credentials.
const nodemailer = require("nodemailer");

let transporter = null;
let mode = "uninitialised";

async function getTransport() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    mode = "smtp";
    console.log(`✉️  Mailer: using SMTP host ${process.env.SMTP_HOST}`);
  } else {
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: test.user, pass: test.pass },
    });
    mode = "ethereal";
    console.log("✉️  Mailer: DEMO mode (Ethereal). Emails are captured, not delivered — a preview link is printed for each.");
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = await getTransport();
  const info = await t.sendMail({
    from: process.env.MAIL_FROM || "GTMS Security <gtms@localhost>",
    to, subject, html, text,
  });
  const preview = nodemailer.getTestMessageUrl(info) || null;
  if (preview) console.log("   ↳ preview:", preview);
  return { messageId: info.messageId, preview, mode };
}

module.exports = { sendMail, getTransport };
