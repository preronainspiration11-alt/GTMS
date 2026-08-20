/* GTMS front-end — talks to the Express API. All data is persisted server-side. */

/* ---------- API client ---------- */
async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* ---------- client state (cache of server data) ---------- */
let ROUTE = [], DEPARTMENTS = [], CATEGORIES = [];
const APP = {
  settings: {}, shift: null, shifts: [], observations: [],
  reportData: null, tab: "home", moreSub: null,
};

async function loadConfig() {
  const c = await api("/config");
  ROUTE = c.checkpoints; DEPARTMENTS = c.departments; CATEGORIES = c.categories; APP.settings = c.settings;
}
const loadActive  = async () => { APP.shift = await api("/shifts/active"); };
const loadShifts  = async () => { APP.shifts = await api("/shifts"); };
const loadObs     = async () => { APP.observations = await api("/observations"); };

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmtHM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDate = (d) => d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
const fmtDT = (d) => `${fmtDate(d)} · ${fmtHM(d)}`;
const cp = (code) => ROUTE.find((r) => r.code === code);
const esc = (s) => (s || "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const gname = (g) => (g || "").split("·")[0].trim();
const ck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>`;

function toast(title, sub, kind) {
  const icons = { g: '<path d="M20 6 9 17l-5-5"/>', r: '<path d="M12 8v5M12 16h.01"/>', b: '<path d="M12 8v5M12 16h.01"/>', a: '<path d="M12 8v5M12 16h.01"/>' };
  const t = el("div", "toast " + (kind || "g"), `<span class="ic"><svg viewBox="0 0 24 24" fill="none">${icons[kind || "g"]}</svg></span><div><b>${esc(title)}</b>${sub ? `<span class="tt">${esc(sub)}</span>` : ""}</div>`);
  $("#toasts").append(t);
  setTimeout(() => { t.style.transition = ".3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 3600);
}
function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.style.opacity = on ? ".6" : ""; }

/* ---------- sheet ---------- */
function sheet(html) { $("#sheet").innerHTML = `<div class="grab"></div>` + html; $("#scrim").classList.add("show"); $("#sheet").classList.add("show"); }
function closeSheet() { $("#scrim").classList.remove("show"); $("#sheet").classList.remove("show"); stopCam(); }
$("#scrim").addEventListener("click", closeSheet);

/* ---------- camera ---------- */
let cam = null, raf = null;
let faceFacing = "user"; // face verification defaults to the FRONT camera
async function startCam(v, facing = "environment") { stopCam(); try { cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false }); v.srcObject = cam; await v.play(); return true; } catch (e) { return false; } }
function stopCam() { if (raf) { cancelAnimationFrame(raf); raf = null; } if (cam) { cam.getTracks().forEach((t) => t.stop()); cam = null; } }
function grab(v, w = 560) { const c = document.createElement("canvas"); const ar = (v.videoWidth || 4) / (v.videoHeight || 3); c.width = w; c.height = Math.round(w / ar); c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.72); }

/* ---------- router ---------- */
function setTab(t) { APP.tab = t; APP.moreSub = null; APP.reportData = null; $$(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === t)); render(); }
$("#tabbar").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) setTab(b.dataset.tab); });

async function render() {
  refreshBadges();
  try {
    if (APP.tab === "home") return await renderHome();
    if (APP.tab === "patrol") return renderPatrol();
    if (APP.tab === "alerts") return renderAlerts();
    if (APP.tab === "reports") return renderReports();
    if (APP.tab === "more") return renderMore();
  } catch (e) { toast("Something went wrong", e.message, "r"); }
}
function appbar(title, sub, opts = {}) {
  const back = opts.back ? `<button class="back" onclick="${opts.back}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>` : "";
  $("#appbar").innerHTML = `${back}<div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div><div class="rt">${opts.right || ""}</div>`;
}
const scrollTop = () => { $("#body").scrollTop = 0; };

/* ---------- beat ring ---------- */
function ringSvg(done, total, dark) {
  const R = 52, C = 2 * Math.PI * R, off = C * (1 - (total ? done / total : 0));
  const track = dark ? "rgba(255,255,255,.22)" : "var(--line2)";
  const bar = dark ? "#eafff5" : "var(--primary)";
  return `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R}" fill="none" stroke="${track}" stroke-width="9"/><circle cx="60" cy="60" r="${R}" fill="none" stroke="${bar}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>`;
}

/* ---------- HOME ---------- */
async function renderHome() {
  await Promise.all([loadActive(), loadObs(), loadShifts()]);
  const s = APP.shift, done = s ? s.scans.length : 0;
  const guardImg = s ? s.faceImg : manualFace("Guard");
  appbar("GTMS", new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }), { right: `<img class="avatar" src="${guardImg}">` });
  const openObs = APP.observations.filter((o) => o.status !== "Resolved").length;
  const weekShifts = APP.shifts.filter((x) => x.endedAt >= Date.now() - 7 * 864e5).length;
  const latest = [...APP.observations].sort((a, b) => b.ts - a.ts).slice(0, 3);

  $("#body").innerHTML = `
    <div class="ring-card">
      <div class="ring-wrap">
        <div class="ring">${ringSvg(done, ROUTE.length, true)}<div class="mid"><div><div class="big">${done}<span class="of">/${ROUTE.length}</span></div><div class="of">checkpoints</div></div></div></div>
        <div class="ring-info">
          ${s ? `<div class="k">On patrol</div><div class="v">${esc(gname(s.guard))}</div><div class="k">Started ${fmtHM(new Date(s.startedAt))}</div>`
              : `<div class="k">Ready to start</div><div class="v">Night beat</div><div class="k">${ROUTE.length} checkpoints on route</div>`}
        </div>
      </div>
      <div style="margin-top:16px;position:relative;z-index:1">
        ${s ? `<button class="btn block" style="background:#fff;color:var(--primary-d)" onclick="setTab('patrol')">Continue patrol →</button>`
            : `<button class="btn block" style="background:#fff;color:var(--primary-d)" onclick="startFlow()">Verify &amp; start patrol</button>`}
      </div>
    </div>
    <div class="row" style="gap:12px">
      <div class="card tight" style="flex:1;margin-bottom:0"><div class="stat"><span class="n r">${openObs}</span><span class="l">Open alerts</span></div></div>
      <div class="card tight" style="flex:1;margin-bottom:0"><div class="stat"><span class="n g">${weekShifts}</span><span class="l">Patrols this week</span></div></div>
    </div>
    <div class="sec-title">Latest alerts</div>
    <div class="card">
      ${latest.length ? latest.map((o) => `
        <div class="listitem" onclick="setTab('alerts')">
          ${o.photo ? `<img class="thumb" src="${o.photo}">` : `<div class="thumb ph">—</div>`}
          <div class="li-body"><div class="li-t">${esc(o.category)}</div><div class="li-s">${esc(cp(o.checkpoint)?.name)} · ${fmtHM(new Date(o.ts))}</div></div>
          ${statusChip(o.status)}
        </div>`).join("") : empty("No alerts logged yet.")}
    </div>
    <div class="sec-title">Recent patrols</div>
    <div class="card">
      ${APP.shifts.length ? APP.shifts.slice(0, 3).map((x) => `
        <div class="listitem" onclick="openReport(${x.id})">
          <div class="pin done" style="width:38px;height:38px;border-radius:12px">${ck}</div>
          <div class="li-body"><div class="li-t">${esc(gname(x.guard))}</div><div class="li-s">${fmtDate(new Date(x.startedAt))} · ${x.scannedCount}/${ROUTE.length} · ${x.obsCount} alerts</div></div>
          <span class="chip">Report</span>
        </div>`).join("") : empty("No completed patrols yet.")}
    </div>`;
  scrollTop();
}
const statusChip = (s) => s === "Resolved" ? `<span class="chip g">Resolved</span>` : s === "Acknowledged" ? `<span class="chip a">Ack'd</span>` : `<span class="chip r">Open</span>`;
const empty = (m) => `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9 12h6"/></svg><div>${esc(m)}</div></div>`;

/* ---------- START PATROL (face verify, req 3) ---------- */
function startFlow() {
  sheet(`<div class="sh"><h2>Verify guard on duty</h2><button class="x" onclick="closeSheet()">✕</button></div>
    <div class="sb">
      <div class="field"><label class="fld">Guard name / ID</label><input id="gn" placeholder="e.g. R. Sharma · SG-114"></div>
      <label class="fld">Face verification <span class="faint">— prevents proxy attendance</span></label>
      <div class="cam" id="fcam"><video id="fvid" playsinline muted></video><div class="ret"></div><div class="hint">Center your face in the frame</div></div>
      <div class="row" style="margin-top:8px;justify-content:flex-end"><button class="btn ghost sm" id="fflip"><svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h13l-2-2M3 7l2 2M21 17H8l2 2M21 17l-2-2"/></svg>Flip camera</button></div>
      <div id="ftag" style="margin-top:6px"></div>
      <div style="margin-top:14px;display:flex;gap:10px">
        <button class="btn line" style="flex:1" id="fcap" disabled>Capture face</button>
        <button class="btn primary" style="flex:1;display:none" id="fstart">Start patrol</button>
      </div>
    </div>`);
  const v = $("#fvid"); let img = null; faceFacing = "user";
  startCam(v, faceFacing).then((ok) => { if (ok) $("#fcap").disabled = false; else { $("#fcam").innerHTML = `<div class="off">Camera unavailable here.<br>Verification recorded as manual check.</div>`; $("#fcap").textContent = "Verify (manual)"; $("#fcap").disabled = false; } });
  $("#fflip").onclick = async () => { faceFacing = faceFacing === "user" ? "environment" : "user"; const ok = await startCam($("#fvid"), faceFacing); if (ok) $("#fcap").disabled = false; };
  $("#fcap").onclick = () => { img = cam ? grab(v, 360) : manualFace($("#gn").value || "Guard"); stopCam(); $("#fcam").innerHTML = `<img class="shot" src="${img}">`; $("#ftag").innerHTML = `<span class="chip g">✓ Face captured &amp; time-stamped</span>`; $("#fcap").style.display = "none"; $("#fstart").style.display = "inline-flex"; };
  $("#fstart").onclick = async (e) => {
    const n = ($("#gn").value || "").trim();
    if (!n) { toast("Name required", "Enter a guard name or ID", "r"); $("#gn").focus(); return; }
    busy(e.target, true);
    try {
      APP.shift = await api("/shifts", { method: "POST", body: JSON.stringify({ guardName: n, faceImg: img }) });
      closeSheet(); toast("Guard verified", "Patrol started for " + gname(n), "g"); setTab("patrol");
    } catch (err) { busy(e.target, false); toast("Could not start", err.message, "r"); }
  };
}
function manualFace(name) {
  const i = (name || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "SG";
  return "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="20" fill="#e5f3ec"/><text x="60" y="74" font-family="Arial" font-size="42" font-weight="700" fill="#0f7a57" text-anchor="middle">${i}</text></svg>`);
}

/* ---------- PATROL ---------- */
function nextIdx() { if (!APP.shift) return -1; const sc = new Set(APP.shift.scans.map((s) => s.code)); return ROUTE.findIndex((c) => !sc.has(c.code)); }
function renderPatrol() {
  appbar("Active patrol", APP.shift ? `${APP.shift.scans.length} of ${ROUTE.length} scanned` : "Not started");
  if (!APP.shift) { $("#body").innerHTML = `<div class="card">${empty("No patrol in progress.")}<button class="btn primary block" onclick="startFlow()">Verify &amp; start patrol</button></div>`; return; }
  const s = APP.shift, scanned = new Set(s.scans.map((x) => x.code)), ni = nextIdx(), done = scanned.size, complete = ni === -1;
  $("#body").innerHTML = `
    <div class="ring-card">
      <div class="ring-wrap">
        <div class="ring">${ringSvg(done, ROUTE.length, true)}<div class="mid"><div><div class="big">${done}<span class="of">/${ROUTE.length}</span></div><div class="of">scanned</div></div></div></div>
        <div class="ring-info"><div class="k">Next checkpoint</div><div class="v" style="font-size:16px;line-height:1.2">${complete ? "All done ✓" : esc(ROUTE[ni].name)}</div><div class="k">${esc(gname(s.guard))} · ${fmtHM(new Date(s.startedAt))}</div></div>
      </div>
      <div style="margin-top:16px;position:relative;z-index:1">
        ${complete ? `<button class="btn block" style="background:#fff;color:var(--primary-d)" onclick="endPatrol()">Close patrol &amp; generate report</button>`
          : `<button class="btn block" style="background:#fff;color:var(--primary-d)" onclick="openScan()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M20 20h.01M17 20v.01"/></svg>Scan next checkpoint</button>`}
      </div>
    </div>
    <div class="sec-title">Route</div><div class="card" id="cpList"></div>
    ${!complete ? `<button class="btn line block" style="color:var(--red)" onclick="endPatrol(true)">End patrol early</button>` : ""}`;
  $("#cpList").innerHTML = ROUTE.map((c, i) => {
    const rec = s.scans.find((x) => x.code === c.code); const cls = rec ? "done" : i === ni ? "next" : "";
    const obsN = s.observations.filter((o) => o.checkpoint === c.code).length;
    return `<div class="cp ${cls}"><span class="idx">${c.seq}</span>
      <span class="pin">${rec ? ck : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/></svg>`}</span>
      <div class="li-body"><div class="nm">${esc(c.name)}</div><div class="meta">${rec ? `✓ scanned ${fmtHM(new Date(rec.ts))}` : esc(c.dept)}${obsN ? ` · <span style="color:var(--red)">${obsN} alert</span>` : ""}</div></div>
      <span class="rt">${rec ? `<span class="chip g">${fmtHM(new Date(rec.ts))}</span>` : i === ni ? `<button class="btn ghost sm" onclick="openScan()">Scan</button>` : `<span class="chip">Pending</span>`}</span></div>`;
  }).join("");
  scrollTop();
}

/* ---------- SCAN (req 4) ---------- */
function openScan() {
  const ni = nextIdx(), next = ROUTE[ni];
  sheet(`<div class="sh"><h2>Scan checkpoint</h2><button class="x" onclick="closeSheet()">✕</button></div>
    <div class="sb">
      <div class="cam" id="scam"><video id="svid" playsinline muted></video><div class="ret"></div><div class="scan"></div><div class="hint">Point at the QR tag — auto-detects</div></div>
      <div class="row" style="justify-content:space-between;margin-top:12px">
        <span class="faint" style="font-size:12.5px">Next: <b style="color:var(--amber)">${esc(next?.name || "—")}</b></span>
        <button class="btn ghost sm" id="sim">Simulate scan</button>
      </div>
    </div>`);
  const v = $("#svid"), c = document.createElement("canvas");
  startCam(v).then((ok) => {
    if (!ok) { $("#scam").innerHTML = `<div class="off">Camera unavailable.<br>Use “Simulate scan”.</div>`; return; }
    const tick = () => {
      if (!cam) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA && window.jsQR) {
        c.width = v.videoWidth; c.height = v.videoHeight; const x = c.getContext("2d"); x.drawImage(v, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height); const r = jsQR(d.data, d.width, d.height);
        if (r && r.data) { const code = r.data.replace(/^GTMS::/, "").trim(); if (cp(code)) { onScan(code); return; } }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  $("#sim").onclick = () => { if (next) onScan(next.code); };
}
async function onScan(code) {
  stopCam();
  try { APP.shift = await api(`/shifts/${APP.shift.id}/scan`, { method: "POST", body: JSON.stringify({ code }) }); }
  catch (e) { toast("Scan failed", e.message, "r"); return; }
  renderScanSheet(code);
}
// Sheet shown after a scan — lists observations already logged here and lets you
// add as many as you want before finishing.
function renderScanSheet(code) {
  const c = cp(code), ts = Date.now();
  const here = (APP.shift?.observations || []).filter((o) => o.checkpoint === code);
  sheet(`<div class="sh"><h2><span class="chip g" style="margin-right:8px">Scanned</span></h2><button class="x" onclick="finishScan()">✕</button></div>
    <div class="sb">
      <div class="card" style="background:var(--primary-t);box-shadow:none;margin-bottom:14px">
        <div class="li-t" style="font-size:17px">${esc(c.name)}</div>
        <div class="row" style="margin-top:10px;gap:18px">
          <div><div class="fld" style="margin:0">Date</div><div class="mono">${fmtDate(new Date(ts))}</div></div>
          <div><div class="fld" style="margin:0">Time</div><div class="mono">${fmtTime(new Date(ts))}</div></div>
        </div>
        <div class="fld" style="margin:10px 0 0">Location auto-recorded · reports to ${esc(c.dept)}</div>
      </div>
      ${here.length ? `<div class="fld" style="margin:0 0 6px">Observations logged here (${here.length})</div>
        <div class="card tight" style="margin-bottom:12px">${here.map((o) => `<div class="listitem" style="padding:8px 0">${o.photo ? `<img class="thumb" src="${o.photo}">` : ""}<div class="li-body"><div class="li-t" style="font-size:13.5px">${esc(o.category)}</div><div class="li-s">${esc(o.dept)}</div></div>${statusChip(o.status)}</div>`).join("")}</div>` : ""}
      <div id="of"><button class="btn line block" id="addObs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>${here.length ? "Add another observation" : "Log an observation"}</button></div>
      <button class="btn primary block" style="margin-top:10px" onclick="finishScan()">${here.length ? "Done" : "Normal — no issue"}</button>
    </div>`);
  $("#addObs").onclick = () => obsForm(c);
}
function obsForm(c) {
  $("#of").innerHTML = `
    <div class="field"><label class="fld">Category</label><select id="oc">${CATEGORIES.map(([x]) => `<option>${x}</option>`).join("")}</select></div>
    <div class="field"><label class="fld">Forward to department</label><select id="od">${DEPARTMENTS.map((d) => `<option ${d === c.dept ? "selected" : ""}>${d}</option>`).join("")}</select></div>
    <div class="field"><label class="fld">Remarks</label><textarea id="or" placeholder="Describe what you observed…"></textarea></div>
    <label class="fld">Photo of observation</label>
    <div class="cam" id="ocam" style="aspect-ratio:16/10"><video id="ovid" playsinline muted></video><div class="hint">Capture the issue</div></div>
    <div class="row" style="margin-top:10px"><button class="btn line sm" id="oshot">Capture photo</button><span id="otag"></span></div>
    <button class="btn amber block" style="margin-top:14px" id="osave">Save &amp; forward</button>`;
  const v = $("#ovid"); let photo = null;
  startCam(v).then((ok) => { if (!ok) { $("#ocam").innerHTML = `<div class="off">Camera unavailable — saving without photo.</div>`; $("#oshot").disabled = true; } });
  $("#oc").onchange = (e) => { const d = CATEGORIES.find((x) => x[0] === e.target.value)?.[1]; if (d) $("#od").value = d; };
  $("#oshot").onclick = () => { if (!cam) return; photo = grab(v, 560); stopCam(); $("#ocam").innerHTML = `<img class="shot" src="${photo}">`; $("#otag").innerHTML = `<span class="chip g">✓ Photo attached</span>`; $("#oshot").style.display = "none"; };
  $("#osave").onclick = async (e) => {
    const r = ($("#or").value || "").trim();
    if (!r) { toast("Add remarks", "Describe the observation first", "r"); $("#or").focus(); return; }
    busy(e.target, true);
    try {
      const dept = $("#od").value, category = $("#oc").value;
      await api("/observations", { method: "POST", body: JSON.stringify({ shiftId: APP.shift.id, checkpoint: c.code, category, dept, remarks: r, photo }) });
      await Promise.all([loadActive(), loadObs()]);
      toast("Forwarded to " + dept, category + " at " + c.name, "r");
      renderScanSheet(c.code); // back to the checkpoint sheet — add another or finish
    } catch (err) { busy(e.target, false); toast("Could not save", err.message, "r"); }
  };
}
async function finishScan() { closeSheet(); await loadObs(); refreshBadges(); if (APP.tab === "patrol") renderPatrol(); }

/* ---------- end patrol -> report (req 6) ---------- */
function endPatrol(early) {
  const s = APP.shift; if (!s) return; const done = s.scans.length;
  const run = async (btn) => {
    busy(btn, true);
    try {
      await api(`/shifts/${s.id}/end`, { method: "POST", body: JSON.stringify({ early: !!early }) });
      const id = s.id; APP.shift = null; closeSheet();
      await loadShifts();
      toast("Patrol closed", "Report scheduled to " + APP.settings.managerEmail + " at " + APP.settings.reportTime, "g");
      openReport(id);
    } catch (e) { busy(btn, false); toast("Could not close", e.message, "r"); }
  };
  if (early && done < ROUTE.length) {
    sheet(`<div class="sh"><h2>End early?</h2><button class="x" onclick="closeSheet()">✕</button></div>
      <div class="sb"><p class="muted" style="margin-top:0">${ROUTE.length - done} checkpoint(s) will be recorded as <b style="color:var(--red)">not covered</b>.</p>
      <div class="row" style="gap:10px"><button class="btn line" style="flex:1" onclick="closeSheet()">Keep going</button><button class="btn red" style="flex:1" id="ce">End &amp; report</button></div></div>`);
    $("#ce").onclick = (e) => run(e.target);
  } else run();
}

/* ---------- ALERTS (req 5) ---------- */
let alertFD = "", alertFS = "";
async function renderAlerts() {
  appbar("Alerts", "Observations routed to departments");
  const q = new URLSearchParams(); if (alertFD) q.set("dept", alertFD); if (alertFS) q.set("status", alertFS);
  APP.observations = await api("/observations" + (q.toString() ? "?" + q : ""));
  const rows = APP.observations;
  const depOpts = `<option value="">All departments</option>` + DEPARTMENTS.map((d) => `<option ${d === alertFD ? "selected" : ""}>${d}</option>`).join("");
  const stOpts = `<option value="">Any status</option>` + ["Open", "Acknowledged", "Resolved"].map((x) => `<option ${x === alertFS ? "selected" : ""}>${x}</option>`).join("");
  $("#body").innerHTML = `
    <div class="row" style="gap:10px;margin:4px 0 6px">
      <select id="afd" style="flex:1">${depOpts}</select><select id="afs" style="flex:1">${stOpts}</select>
    </div>
    ${rows.length ? rows.map((o) => `
      <div class="card tight" onclick="openObs(${o.id})">
        <div class="row">
          ${o.photo ? `<img class="thumb" src="${o.photo}">` : `<div class="thumb ph">—</div>`}
          <div class="li-body"><div class="row" style="gap:8px"><span class="li-t" style="font-size:14px">${esc(o.category)}</span>${statusChip(o.status)}</div>
          <div class="li-s">${esc(cp(o.checkpoint)?.name)} · ${fmtDT(new Date(o.ts))}</div></div>
        </div>
        <div class="row" style="margin-top:8px;gap:8px"><span class="chip b">${esc(o.dept)}</span><span class="muted" style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.remarks)}</span></div>
      </div>`).join("") : `<div class="card">${empty("No alerts match this filter.")}</div>`}`;
  $("#afd").onchange = (e) => { alertFD = e.target.value; renderAlerts(); };
  $("#afs").onchange = (e) => { alertFS = e.target.value; renderAlerts(); };
  scrollTop();
}
function openObs(id) {
  const o = APP.observations.find((x) => x.id === id); if (!o) return;
  const nextBtn = o.status === "Open" ? `<button class="btn amber block" onclick="setObs(${o.id},'Acknowledged')">Acknowledge</button>`
    : o.status === "Acknowledged" ? `<button class="btn primary block" onclick="setObs(${o.id},'Resolved')">Mark resolved</button>`
    : `<div class="chip g" style="justify-content:center;padding:12px">Resolved &amp; closed</div>`;
  sheet(`<div class="sh"><h2>${esc(o.category)}</h2><button class="x" onclick="closeSheet()">✕</button></div>
    <div class="sb">
      ${o.photo ? `<img src="${o.photo}" style="width:100%;border-radius:16px;margin-bottom:14px;display:block">` : ""}
      <div class="card tight" style="background:var(--screen);box-shadow:none">
        <div class="row" style="justify-content:space-between"><span class="muted">Location</span><b>${esc(cp(o.checkpoint)?.name)}</b></div>
        <div class="row" style="justify-content:space-between;margin-top:6px"><span class="muted">Logged</span><span class="mono">${fmtDT(new Date(o.ts))}</span></div>
        <div class="row" style="justify-content:space-between;margin-top:6px"><span class="muted">Department</span><span class="chip b">${esc(o.dept)}</span></div>
        <div class="row" style="justify-content:space-between;margin-top:6px"><span class="muted">Status</span>${statusChip(o.status)}</div>
      </div>
      <div class="fld" style="margin:14px 0 4px">Remarks</div><p style="margin:0 0 16px">${esc(o.remarks)}</p>${nextBtn}
    </div>`);
}
async function setObs(id, st) {
  try { await api(`/observations/${id}`, { method: "PATCH", body: JSON.stringify({ status: st }) }); toast("Marked " + st.toLowerCase(), null, "b"); closeSheet(); await loadObs(); refreshBadges(); if (APP.tab === "alerts") renderAlerts(); }
  catch (e) { toast("Update failed", e.message, "r"); }
}

/* ---------- REPORTS (req 6) ---------- */
async function renderReports() {
  if (APP.reportData) return renderReportDetail();
  appbar("Reports", "Emailed to the Security Manager daily");
  await loadShifts();
  const list = APP.shifts;
  $("#body").innerHTML = list.length ? list.map((s) => {
    const missed = ROUTE.length - s.scannedCount;
    return `<div class="card tight" onclick="openReport(${s.id})">
      <div class="row">
        <div class="ring" style="width:52px;height:52px;flex:none">${ringSvg(s.scannedCount, ROUTE.length, false)}<div class="mid"><div style="font-family:var(--disp);font-weight:700;font-size:14px">${s.scannedCount}</div></div></div>
        <div class="li-body"><div class="li-t">${fmtDate(new Date(s.startedAt))}</div><div class="li-s">${esc(gname(s.guard))} · ${fmtHM(new Date(s.startedAt))}–${fmtHM(new Date(s.endedAt))}</div></div>
        <div style="text-align:right">${missed ? `<span class="chip a">${missed} missed</span>` : `<span class="chip g">Full route</span>`}<div class="li-s" style="margin-top:4px">${s.obsCount} alerts</div></div>
      </div>
    </div>`;
  }).join("") : `<div class="card">${empty("No reports yet. Finish a patrol to generate one.")}</div>`;
  scrollTop();
}
async function openReport(id) {
  APP.tab = "reports"; $$(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === "reports"));
  try { APP.reportData = await api(`/shifts/${id}`); renderReportDetail(); }
  catch (e) { toast("Could not load report", e.message, "r"); }
}
function renderReportDetail() {
  const s = APP.reportData; if (!s) { return renderReports(); }
  appbar("Patrol report", fmtDate(new Date(s.startedAt)), { back: "backReports()" });
  const obs = s.observations, missed = ROUTE.filter((c) => !s.scans.find((x) => x.code === c.code));
  const dur = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
  $("#body").innerHTML = `
    <div class="card">
      <div class="row"><img class="avatar" src="${s.faceImg}"><div class="li-body"><div class="li-t">${esc(s.guard)}</div><div class="li-s">${fmtHM(new Date(s.startedAt))}–${fmtHM(new Date(s.endedAt))} · ${dur} min</div></div></div>
      <div class="row" style="gap:10px;margin-top:14px">
        <div class="card tight" style="flex:1;margin:0;box-shadow:none;background:var(--screen)"><div class="stat"><span class="n g">${s.scans.length}</span><span class="l">Covered</span></div></div>
        <div class="card tight" style="flex:1;margin:0;box-shadow:none;background:var(--screen)"><div class="stat"><span class="n ${missed.length ? "a" : "g"}">${missed.length}</span><span class="l">Not covered</span></div></div>
        <div class="card tight" style="flex:1;margin:0;box-shadow:none;background:var(--screen)"><div class="stat"><span class="n r">${obs.length}</span><span class="l">Alerts</span></div></div>
      </div>
    </div>
    <div class="row" style="gap:10px;margin-bottom:14px">
      <button class="btn line" style="flex:1" onclick="exportReportExcel()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13l3 3M12 13l-3 3"/></svg>Excel</button>
      <button class="btn amber" style="flex:1" onclick="emailReport(${s.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>Email</button>
    </div>
    ${missed.length ? `<div class="sec-title">Not covered</div><div class="card"><div class="row" style="flex-wrap:wrap;gap:8px">${missed.map((m) => `<span class="chip a">${esc(m.name)}</span>`).join("")}</div></div>` : ""}
    <div class="sec-title">Checkpoint log</div>
    <div class="card">${ROUTE.map((c) => { const r = s.scans.find((x) => x.code === c.code); return `<div class="cp ${r ? "done" : ""}"><span class="idx">${c.seq}</span><span class="pin">${r ? ck : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/></svg>`}</span><div class="li-body"><div class="nm">${esc(c.name)}</div></div><span class="rt">${r ? `<span class="chip g">${fmtTime(new Date(r.ts))}</span>` : `<span class="chip a">Missed</span>`}</span></div>`; }).join("")}</div>
    <div class="sec-title">Observations forwarded (${obs.length})</div>
    <div class="card">${obs.length ? obs.map((o) => `<div class="listitem">${o.photo ? `<img class="thumb" src="${o.photo}">` : `<div class="thumb ph">—</div>`}<div class="li-body"><div class="li-t" style="font-size:14px">${esc(o.category)}</div><div class="li-s">${esc(cp(o.checkpoint)?.name)} → ${esc(o.dept)}</div></div>${statusChip(o.status)}</div>`).join("") : empty("No observations this patrol.")}</div>`;
  scrollTop();
}
function exportReportExcel() {
  const s = APP.reportData;
  if (!s) { toast("Open a report first", null, "r"); return; }
  if (!window.XLSX) { toast("Excel library not loaded", "Check your connection and retry", "r"); return; }
  const scanned = new Map(s.scans.map((x) => [x.code, x.ts]));
  const dur = s.endedAt ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000)) : 0;

  const summary = [
    ["GTMS — Guard Patrol Report"],
    [],
    ["Guard on duty", s.guard],
    ["Date", fmtDate(new Date(s.startedAt))],
    ["Start time", fmtHM(new Date(s.startedAt))],
    ["End time", s.endedAt ? fmtHM(new Date(s.endedAt)) : "—"],
    ["Duration (min)", dur],
    ["Checkpoints covered", `${s.scans.length} of ${ROUTE.length}`],
    ["Not covered", ROUTE.length - s.scans.length],
    ["Observations", s.observations.length],
    ["Report recipient", APP.settings.managerEmail || ""],
  ];
  const cpRows = [["#", "Location", "Code", "Department", "Scanned at", "Status"]].concat(
    ROUTE.map((c) => {
      const ts = scanned.get(c.code);
      return [c.seq, c.name, c.code, c.dept, ts ? `${fmtDate(new Date(ts))} ${fmtTime(new Date(ts))}` : "", ts ? "Scanned" : "Missed"];
    })
  );
  const obsRows = [["Location", "Category", "Department", "Remarks", "Status", "Logged at"]].concat(
    s.observations.map((o) => [cp(o.checkpoint)?.name || o.checkpoint, o.category, o.dept, o.remarks, o.status, `${fmtDate(new Date(o.ts))} ${fmtTime(new Date(o.ts))}`])
  );

  const wb = XLSX.utils.book_new();
  const sh1 = XLSX.utils.aoa_to_sheet(summary); sh1["!cols"] = [{ wch: 22 }, { wch: 40 }];
  const sh2 = XLSX.utils.aoa_to_sheet(cpRows); sh2["!cols"] = [{ wch: 4 }, { wch: 34 }, { wch: 8 }, { wch: 22 }, { wch: 20 }, { wch: 10 }];
  const sh3 = XLSX.utils.aoa_to_sheet(obsRows); sh3["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 20 }, { wch: 46 }, { wch: 14 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, sh1, "Summary");
  XLSX.utils.book_append_sheet(wb, sh2, "Checkpoints");
  XLSX.utils.book_append_sheet(wb, sh3, "Observations");

  const fname = `GTMS-Report-${fmtDate(new Date(s.startedAt)).replace(/ /g, "-")}-${gname(s.guard).replace(/[^a-z0-9]+/gi, "")}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast("Excel exported", fname, "g");
}
function backReports() { APP.reportData = null; renderReports(); }
function emailReport(id) {
  const s = APP.reportData; if (!s || s.id !== id) return;
  const obs = s.observations, missed = ROUTE.filter((c) => !s.scans.find((x) => x.code === c.code));
  const nd = new Date((s.endedAt || Date.now()) + 864e5); const [h, m] = (APP.settings.reportTime || "07:00").split(":"); nd.setHours(+h, +m, 0, 0);
  sheet(`<div class="sh"><h2>Daily report email</h2><button class="x" onclick="closeSheet()">✕</button></div>
    <div class="sb">
      <div class="mail">
        <div class="mh">
          <div class="rowm"><span class="k">To</span><span>${esc(APP.settings.managerEmail)}</span></div>
          <div class="rowm"><span class="k">Subject</span><span><b>Guard Patrol Report — ${fmtDate(new Date(s.startedAt))}</b></span></div>
          <div class="rowm"><span class="k">Send</span><span class="faint">${fmtDT(nd)} (auto, next morning)</span></div>
        </div>
        <div class="mb"><h4>Summary</h4>
          <p style="margin:0 0 8px">${esc(gname(s.guard))} patrolled ${fmtHM(new Date(s.startedAt))}–${fmtHM(new Date(s.endedAt))}, covering <b style="color:var(--primary)">${s.scans.length}</b>/${ROUTE.length} checkpoints${missed.length ? `, <b style="color:var(--amber)">${missed.length}</b> not covered` : " (full route)"}. ${obs.length} observation(s) forwarded.</p>
          ${obs.length ? `<ul style="margin:0;padding-left:16px">${obs.map((o) => `<li>${esc(cp(o.checkpoint)?.name)} — ${esc(o.category)} → ${esc(o.dept)}</li>`).join("")}</ul>` : ""}
          <p class="faint" style="margin:8px 0 0;font-size:11.5px">Checkpoint log &amp; photos attached · auto-generated by GTMS.</p>
        </div>
      </div>
      <button class="btn primary block" style="margin-top:14px" id="sn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>Send now</button>
    </div>`);
  $("#sn").onclick = async (e) => {
    busy(e.target, true);
    try {
      const res = await api(`/shifts/${id}/email`, { method: "POST" });
      closeSheet();
      toast("Report emailed", "Sent to " + res.to, "g");
      if (res.preview) { toast("Demo inbox", "Open the preview link in the terminal", "b"); console.log("Email preview:", res.preview); }
    } catch (err) { busy(e.target, false); toast("Send failed", err.message, "r"); }
  };
}

/* ---------- MORE ---------- */
function renderMore() {
  if (APP.moreSub === "qr") return renderQR();
  if (APP.moreSub === "route") return renderRoute();
  if (APP.moreSub === "settings") return renderSettings();
  appbar("More", "Setup &amp; tools");
  const mi = (icon, bg, col, t, s, go) => `<div class="menuitem" onclick="${go}"><div class="mi-ic" style="background:${bg};color:${col}">${icon}</div><div class="li-body"><div class="mi-t">${t}</div><div class="mi-s">${s}</div></div><span class="arr"><svg viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></span></div>`;
  $("#body").innerHTML = `
    <div class="card">
      ${mi('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M20 20h.01M17 20v.01"/></svg>', "var(--blue-t)", "var(--blue)", "Checkpoint QR tags", "Print &amp; mount the " + ROUTE.length + " tags", "gotoSub('qr')")}
      ${mi('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>', "var(--primary-t)", "var(--primary)", "Patrol route", "Sequence &amp; department mapping", "gotoSub('route')")}
      ${mi('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>', "var(--amber-t)", "var(--amber)", "Report recipient", "Manager email &amp; daily time", "gotoSub('settings')")}
    </div>
    <div class="card" style="text-align:center;color:var(--faint);font-size:12px">
      <b style="color:var(--muted)">Guard Tour Management System</b><br>Manufacturing Plant · Unit 1<br>Data saved to server · reports emailed daily
    </div>`;
  scrollTop();
}
function gotoSub(x) { APP.moreSub = x; renderMore(); }
function backMore() { APP.moreSub = null; renderMore(); }

function renderQR() {
  appbar("QR tags", ROUTE.length + " checkpoints", { back: "backMore()", right: `<button class="back" onclick="window.print()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg></button>` });
  $("#body").innerHTML = `<p class="muted" style="font-size:13px;margin:4px 4px 12px">One weatherproof tag per location, encoded <span class="mono">GTMS::code</span>. Print and mount on the beat.</p><div class="qr-grid" id="qrg"></div>`;
  const g = $("#qrg");
  ROUTE.forEach((c) => {
    const cell = el("div", "qr-cell"); const box = el("div", "box"); cell.append(box);
    cell.insertAdjacentHTML("beforeend", `<div class="cn">${esc(c.name)}</div><div class="cc">GTMS::${c.code}</div>`); g.append(cell);
    const p = "GTMS::" + c.code;
    if (window.QRCode) { try { new QRCode(box, { text: p, width: 100, height: 100, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { box.innerHTML = fbQR(p); } }
    else box.innerHTML = fbQR(p);
  });
  scrollTop();
}
const fbQR = (t) => `<div style="width:100px;height:100px;display:grid;place-items:center;border:1px dashed var(--line2);border-radius:8px;font-family:monospace;font-size:9px;color:var(--faint);padding:6px">${esc(t)}</div>`;

function renderRoute() {
  appbar("Patrol route", "Tap a department to re-route", { back: "backMore()" });
  $("#body").innerHTML = `<div class="card">${ROUTE.map((c) => `<div class="cp"><span class="idx">${c.seq}</span><span class="pin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/></svg></span><div class="li-body"><div class="nm">${esc(c.name)}</div><div class="meta mono">${c.code}</div></div><select class="rt" data-code="${c.code}" style="width:auto;padding:7px 9px;font-size:12px;max-width:130px">${DEPARTMENTS.map((d) => `<option ${d === c.dept ? "selected" : ""}>${d}</option>`).join("")}</select></div>`).join("")}</div>`;
  $$("select[data-code]").forEach((sel) => sel.onchange = async (e) => {
    const code = e.target.dataset.code, dept = e.target.value;
    try { await api(`/config/checkpoints/${code}`, { method: "PUT", body: JSON.stringify({ dept }) }); const c = cp(code); c.dept = dept; toast("Route updated", c.name + " → " + dept, "b"); }
    catch (err) { toast("Update failed", err.message, "r"); }
  });
  scrollTop();
}
function renderSettings() {
  appbar("Report recipient", "Where daily reports are sent", { back: "backMore()" });
  $("#body").innerHTML = `<div class="card">
    <div class="field"><label class="fld">Security Manager email</label><input id="me" value="${esc(APP.settings.managerEmail)}"></div>
    <div class="field"><label class="fld">Daily report time</label><input id="mt" type="time" value="${APP.settings.reportTime}"></div>
    <button class="btn primary block" id="ms">Save</button>
  </div>
  <div class="sec-title">Departments</div>
  <div class="card">${DEPARTMENTS.map((d) => `<div class="row" style="justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line)"><span>${d}</span><span class="chip">${ROUTE.filter((c) => c.dept === d).length} loc</span></div>`).join("")}</div>`;
  $("#ms").onclick = async (e) => {
    busy(e.target, true);
    try {
      const r = await api("/config/settings", { method: "PUT", body: JSON.stringify({ managerEmail: $("#me").value.trim(), reportTime: $("#mt").value }) });
      APP.settings = r; busy(e.target, false); toast("Saved", "Reports → " + r.managerEmail, "g");
    } catch (err) { busy(e.target, false); toast("Save failed", err.message, "r"); }
  };
  scrollTop();
}

/* ---------- badges ---------- */
function refreshBadges() {
  const n = APP.observations.filter((o) => o.status === "Open").length;
  const b = $("#tabBadge"); b.textContent = n; b.style.display = n ? "grid" : "none";
}

/* ---------- boot ---------- */
(async function boot() {
  $("#appbar").innerHTML = `<div><h1>GTMS</h1><div class="sub">Loading…</div></div>`;
  try {
    await loadConfig();
    await Promise.all([loadActive(), loadObs(), loadShifts()]);
    render();
  } catch (e) {
    $("#body").innerHTML = `<div class="card" style="margin-top:40px">${empty("Cannot reach the server. Is it running? (npm start)")}</div>`;
    console.error(e);
  }
})();
