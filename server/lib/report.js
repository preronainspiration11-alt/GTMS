// Builds the detailed patrol report (requirement 6) as subject + HTML + text.
const { ROUTE } = require("./route");

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const guardName = (g) => (g || "").split("·")[0].trim();

function buildReport(shift, baseUrl = "") {
  const scanned = new Map(shift.scans.map((s) => [s.code, s.ts]));
  const missed = ROUTE.filter((c) => !scanned.has(c.code));
  const obs = shift.observations || [];
  const dur = shift.endedAt ? Math.max(1, Math.round((shift.endedAt - shift.startedAt) / 60000)) : 0;
  const subject = `Guard Patrol Report — ${fmtDate(shift.startedAt)} — ${guardName(shift.guard)}`;

  const rows = ROUTE.map((c) => {
    const ts = scanned.get(c.code);
    return `<tr>
      <td style="padding:6px 8px;color:#94a3b8;font-family:monospace">${c.seq}</td>
      <td style="padding:6px 8px">${c.name}</td>
      <td style="padding:6px 8px;font-family:monospace">${ts ? fmtTime(ts) : "—"}</td>
      <td style="padding:6px 8px;color:${ts ? "#0f7a57" : "#d9891c"};font-weight:600">${ts ? "Scanned" : "Missed"}</td>
    </tr>`;
  }).join("");

  const obsRows = obs.length
    ? obs.map((o) => {
        const cp = ROUTE.find((c) => c.code === o.checkpoint);
        const src = o.photo ? (o.photo.startsWith("data:") || o.photo.startsWith("http") ? o.photo : baseUrl + o.photo) : null;
        const img = src ? `<img src="${src}" width="54" height="54" style="border-radius:8px;object-fit:cover">` : "—";
        return `<tr>
          <td style="padding:6px 8px">${img}</td>
          <td style="padding:6px 8px">${cp ? cp.name : o.checkpoint}</td>
          <td style="padding:6px 8px">${o.category}</td>
          <td style="padding:6px 8px"><b>${o.dept}</b></td>
          <td style="padding:6px 8px;color:#475569">${(o.remarks || "").replace(/</g, "&lt;")}</td>
          <td style="padding:6px 8px">${o.status}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="6" style="padding:10px 8px;color:#64748b">No observations logged during this patrol.</td></tr>`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;color:#16202b">
    <div style="background:linear-gradient(135deg,#12905f,#0b5f43);color:#fff;padding:20px 22px;border-radius:14px 14px 0 0">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Guard Tour Management System</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">Daily Patrol Report</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;padding:20px 22px">
      <table style="width:100%;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:4px 0;color:#64748b;width:150px">Guard on duty</td><td style="padding:4px 0"><b>${shift.guard}</b></td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Date</td><td style="padding:4px 0">${fmtDate(shift.startedAt)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Patrol window</td><td style="padding:4px 0">${fmtTime(shift.startedAt)}–${shift.endedAt ? fmtTime(shift.endedAt) : "—"} (${dur} min)</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Coverage</td><td style="padding:4px 0"><b style="color:${missed.length ? "#d9891c" : "#0f7a57"}">${shift.scans.length} / ${ROUTE.length}</b> checkpoints${missed.length ? ` — ${missed.length} not covered` : " — full route"}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Observations</td><td style="padding:4px 0">${obs.length} forwarded to departments</td></tr>
      </table>

      ${missed.length ? `<p style="font-size:14px"><b style="color:#d9891c">Checkpoints not covered:</b> ${missed.map((m) => m.name).join(", ")}.</p>` : ""}

      <h3 style="font-size:14px;margin:18px 0 6px">Checkpoint log</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;color:#64748b;border-bottom:1px solid #e2e8f0">
          <th style="padding:6px 8px">#</th><th style="padding:6px 8px">Location</th><th style="padding:6px 8px">Time</th><th style="padding:6px 8px">Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h3 style="font-size:14px;margin:18px 0 6px">Observations forwarded</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;color:#64748b;border-bottom:1px solid #e2e8f0">
          <th style="padding:6px 8px">Photo</th><th style="padding:6px 8px">Location</th><th style="padding:6px 8px">Category</th><th style="padding:6px 8px">Department</th><th style="padding:6px 8px">Remarks</th><th style="padding:6px 8px">Status</th></tr></thead>
        <tbody>${obsRows}</tbody>
      </table>

      <p style="color:#94a3b8;font-size:12px;margin-top:20px">Generated automatically by GTMS.</p>
    </div>
  </div>`;

  const text =
    `GTMS Daily Patrol Report\n${subject}\n\n` +
    `Guard: ${shift.guard}\nDate: ${fmtDate(shift.startedAt)}\n` +
    `Window: ${fmtTime(shift.startedAt)}-${shift.endedAt ? fmtTime(shift.endedAt) : "-"}\n` +
    `Coverage: ${shift.scans.length}/${ROUTE.length}\n` +
    (missed.length ? `Not covered: ${missed.map((m) => m.name).join(", ")}\n` : "") +
    `Observations (${obs.length}):\n` +
    obs.map((o) => {
      const cp = ROUTE.find((c) => c.code === o.checkpoint);
      return `  - ${cp ? cp.name : o.checkpoint} — ${o.category} -> ${o.dept} (${o.status})`;
    }).join("\n");

  return { subject, html, text };
}

module.exports = { buildReport };
