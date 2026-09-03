# Connecting GTMS to Supabase (free, permanent database)

Your data (patrols, observations, photos, settings) is stored in a **Postgres
database**. Supabase gives you one free, and it stays put — unlike Render's free
disk, which resets. The app creates its own tables automatically on first run;
you only need to give it the connection string.

---

## 1. Create the database

1. Go to <https://supabase.com> → sign up (free) → **New project**.
2. Pick a name (e.g. `gtms`), set a **database password** (save it — you'll need it),
   choose the region nearest you, and click **Create new project**.
3. Wait ~1 minute for it to finish provisioning.

## 2. Get the connection string

1. In your project: **Connect** (top bar) — or **Project Settings → Database**.
2. Find **Connection string** and choose the **Session pooler** / **URI** option
   (it looks like `postgresql://postgres.xxxx:[PASSWORD]@...pooler.supabase.com:5432/postgres`).
   The pooler URL works reliably from hosts like Render.
3. Copy it and replace `[PASSWORD]` (or `[YOUR-PASSWORD]`) with the database
   password you set in step 1.

## 3. Use it locally (to test on your PC)

1. In the project folder, copy the example env file:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Open `.env` in VS Code and paste your string:
   ```
   DATABASE_URL=postgresql://postgres.xxxx:YOURPASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
   ```
3. Install and run:
   ```powershell
   npm install
   npm run seed      # optional demo data — now saved in Supabase
   npm start
   ```
   Open <http://localhost:3000>. Anything you do is now saved in Supabase; you can
   even see the rows under **Table Editor** in the Supabase dashboard.

## 4. Use it on Render (your live site)

1. Render → your **gtms** service → **Environment** → **Add Environment Variable**:
   - **Key:** `DATABASE_URL`
   - **Value:** the same connection string
2. **Save** — Render redeploys automatically. Your live app now reads and writes
   the Supabase database, and data survives restarts and redeploys.

> If you deploy fresh with the Blueprint, Render will prompt for `DATABASE_URL`
> because `render.yaml` marks it as a value you must supply.

---

## Notes

- **Tables** are created automatically the first time the server starts — no SQL
  to run yourself. To load demo rows once, run `npm run seed` (locally) or use the
  Supabase SQL editor later.
- **Photos** are stored in the database as data-URLs, so they persist with
  everything else — there's no separate file storage to configure.
- **Free tier** is enough for this app. Very old data can be trimmed later if the
  500 MB database ever fills (mostly from photos).
- **Security:** the connection string contains your DB password — it lives only in
  `.env` (git-ignored) and in Render's environment settings, never in the code.
