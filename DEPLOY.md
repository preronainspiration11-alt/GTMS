# Deploying GTMS to the internet (GitHub + Render)

This gives your app a permanent `https://…` address, always on, reachable from
any phone or computer. Two stages: **push the code to GitHub**, then **connect
GitHub to Render**. Takes about 15 minutes the first time.

---

## Stage 0 — One-time installs

- **Git** — check in PowerShell: `git --version`. If it's missing, install from
  <https://git-scm.com/download/win> (accept all defaults), then reopen PowerShell.
- **A GitHub account** — free, sign up at <https://github.com>.
- **A Render account** — free, sign up at <https://render.com> (choose
  "Sign in with GitHub" — it makes Stage 2 easier).

---

## Stage 1 — Put the project on GitHub

### 1a. Create an empty repository on GitHub
1. Go to <https://github.com/new>.
2. **Repository name:** `gtms`
3. Leave it **Public** (or Private — both work).
4. **Do NOT** tick "Add a README" / .gitignore / license. Keep it empty.
5. Click **Create repository**. Keep that page open — you'll need the URL,
   which looks like `https://github.com/YOURNAME/gtms.git`.

### 1b. Push your code (in PowerShell, inside the project folder)
Make sure you're in the folder that has `package.json`:
```powershell
cd path\to\gtms      # e.g. cd $HOME\Desktop\gtms
git init
git add .
git commit -m "GTMS initial version"
git branch -M main
git remote add origin https://github.com/YOURNAME/gtms.git   # <-- your URL
git push -u origin main
```
The first `git push` opens a browser window to sign in to GitHub — approve it.
When it finishes, refresh the GitHub page: your files are now there.

> The `.gitignore` already excludes `node_modules/`, `data/`, `uploads/` and
> `.env`, so no bulky or secret files get uploaded.

---

## Stage 2 — Deploy on Render

### The easy way (Blueprint — uses the included `render.yaml`)
1. Go to the Render dashboard → **New +** → **Blueprint**.
2. Choose your `gtms` GitHub repo → **Connect**.
3. Render reads `render.yaml` and shows a `gtms` web service → **Apply**.
4. Watch the log. When it says **Live**, click the URL at the top
   (`https://gtms-xxxx.onrender.com`). That's your app. Open it on your phone —
   the camera now works because Render serves it over HTTPS.

### The manual way (if you skip the Blueprint)
**New +** → **Web Service** → pick the repo, then set:
- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment variable:** add `NODE_VERSION` = `22.22.2`
- Click **Create Web Service**.

### Load the demo data once (optional)
After the first deploy, open your service → **Shell** tab → run:
```
npm run seed
```
(Only meaningful if you've enabled a persistent disk — see below — otherwise it
reseeds each restart anyway.)

---

## Turning on real email
In Render: your service → **Environment** → add these (from your mail provider;
Gmail needs an [App Password](https://support.google.com/accounts/answer/185833)):
```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 465
SMTP_SECURE = true
SMTP_USER = you@gmail.com
SMTP_PASS = your-app-password
MAIL_FROM = GTMS Security <you@gmail.com>
```
Save — Render redeploys automatically. With these blank, the app stays in demo
mode and prints an email preview link in the **Logs** tab instead.

---

## Making data permanent (important)
On Render's **free** plan the filesystem is wiped on every restart/redeploy, so
patrols, observations and photos reset. That's fine for testing. To keep data:

1. Upgrade the service to the **Starter** plan.
2. Service → **Disks** → **Add Disk**: name `gtms-data`, mount path `/var/data`, size 1 GB.
3. Service → **Environment** → add:
   - `DATA_DIR` = `/var/data/data`
   - `UPLOADS_DIR` = `/var/data/uploads`
4. Save. Now the database and uploaded images live on the disk and survive restarts.

(Or uncomment the `disk:` and `DATA_DIR`/`UPLOADS_DIR` blocks already in
`render.yaml` before deploying.)

---

## Updating the app later
Change files locally, then:
```powershell
git add .
git commit -m "describe your change"
git push
```
Render auto-deploys the new version within a minute.

---

## Two things to plan for real use
- **Login/roles:** right now anyone with the URL can run a patrol. Add
  authentication before real deployment (ask and I'll build guard + manager logins).
- **Free plan sleeps:** a free Render service spins down after ~15 min idle and
  takes a few seconds to wake on the next visit. The Starter plan stays awake.
