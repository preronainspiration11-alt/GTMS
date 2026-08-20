# GTMS — Guard Tour Management System

A full-stack guard patrol system for a manufacturing plant: QR-checkpoint scanning,
guard face verification, observation routing to departments, and automated daily
email reports to the Security Manager.

- **Frontend:** mobile-style web app (vanilla JS, no build step)
- **Backend:** Node.js + Express REST API
- **Database:** Postgres (Supabase) via the `pg` driver — free & persistent (see **SUPABASE.md**)
- **Email:** Nodemailer (real SMTP, or an automatic demo inbox out of the box)
- **Scheduler:** `node-cron` — emails each completed patrol's report the next morning

---

> **Want it online with its own URL?** See **DEPLOY.md** for GitHub + Render steps.

## 1. Requirements

- **Node.js 22.5 or newer** (`node -v` to check) — <https://nodejs.org>
- npm (comes with Node)

## 2. Run it in VS Code

1. Open this folder in VS Code (`File → Open Folder…`).
2. Open a terminal (`Terminal → New Terminal`) and install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Load demo data so the app isn't empty on first launch:
   ```bash
   npm run seed
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open **http://localhost:3000** in your browser.
   (Tip: use the browser's device toolbar / responsive mode to see the phone layout.)

Use `npm run dev` instead of `npm start` for auto-restart on file changes.

## 3. Email setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env      # macOS/Linux
copy .env.example .env    # Windows
```

- **Do nothing else** → the app runs in **demo email mode**. Every report is
  "sent" to a free Ethereal test inbox and the server prints a **preview link**
  in the terminal — click it to see the exact email. Nothing leaves your machine.
- **To send real email**, fill in the `SMTP_*` values in `.env`. For Gmail, create
  an [App Password](https://support.google.com/accounts/answer/185833) and use:
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=465
  SMTP_SECURE=true
  SMTP_USER=you@gmail.com
  SMTP_PASS=your-app-password
  ```

The recipient (Security Manager) address and the daily send time are set inside
the app under **More → Report recipient**.

## 4. Camera & QR scanning

The camera (face verification, observation photos, live QR scanning) needs a
**secure context**: it works on `http://localhost` automatically. If you serve
the app on a LAN IP or domain, use HTTPS. Where the camera is unavailable, the
app falls back to a manual check and a **Simulate scan** button, so the full
flow still works.

To scan for real: open **More → QR tags**, print the sheet, mount each tag at
its location, then scan them on patrol.

## 5. How it maps to the requirements

| # | Requirement | Where |
|---|-------------|-------|
| 1 | Configured patrol route (25 checkpoints) | `server/lib/route.js`, editable in **More → Patrol route** |
| 2 | QR codes at every location | **More → QR tags** (printable), encoded `GTMS::<code>` |
| 3 | Face verification before patrol | **Verify & start patrol** → `POST /api/shifts` stores the face image |
| 4 | Scan auto-records date/time/location + photo/remarks | **Scan** flow → `POST /api/shifts/:id/scan`, `POST /api/observations` |
| 5 | Observations forwarded to departments | Each observation carries a routed `dept`; tracked in **Alerts** |
| 6 | Daily report auto-emailed to the Manager | `node-cron` in `server/index.js` + `server/jobs.js`; on-demand via **Email report to Manager** |

## 6. Project structure

```
gtms/
├─ package.json
├─ .env.example
├─ server/
│  ├─ index.js            Express app, static hosting, daily cron
│  ├─ db.js               SQLite schema + seed of route/departments/settings
│  ├─ mailer.js           Nodemailer (SMTP or demo Ethereal)
│  ├─ jobs.js             report emailing (manual + daily)
│  ├─ seed.js             demo data  (npm run seed)
│  ├─ lib/
│  │  ├─ route.js         the 25-checkpoint route, departments, categories
│  │  ├─ images.js        saves base64 captures to /uploads
│  │  └─ report.js        builds the report email (HTML + text)
│  └─ routes/
│     ├─ config.js        GET config, update settings & checkpoint depts
│     ├─ shifts.js        start / scan / end / email a patrol
│     └─ observations.js  create / list / update status
└─ public/                the web app (index.html, app.js, styles.css)
```

Generated at runtime (git-ignored): `data/` (the SQLite DB) and `uploads/` (images).

## 7. API reference (quick)

```
GET    /api/config                     route, departments, categories, settings
PUT    /api/config/settings            { managerEmail, reportTime }
PUT    /api/config/checkpoints/:code   { dept }
GET    /api/shifts/active              current patrol or null
GET    /api/shifts                     completed patrol summaries
GET    /api/shifts/:id                 full patrol detail
POST   /api/shifts                     { guardName, faceImg }  → start
POST   /api/shifts/:id/scan            { code }                → record checkpoint
POST   /api/shifts/:id/end             { early }               → close patrol
POST   /api/shifts/:id/email           email this report now
GET    /api/observations?dept=&status= list observations
POST   /api/observations               { shiftId, checkpoint, category, dept, remarks, photo }
PATCH  /api/observations/:id           { status }
```

## 8. Moving to production (notes)

- Swap SQLite for Postgres/MySQL if you need many concurrent writers.
  is small and isolated in the routes).
- Put the app behind HTTPS (nginx/Caddy) so the camera works on real devices.
- Add authentication (guard login, manager dashboard roles) before deploying.
- Store images in object storage (S3) instead of the local `uploads/` folder.
