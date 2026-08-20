// Demo data:  npm run seed   (add --fresh to wipe shifts/observations first)
require("dotenv").config();
const { q, pool, init } = require("./db");
const { ROUTE } = require("./lib/route");

const faceSvg = (name) => {
  const i = (name || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "SG";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="20" fill="#e5f3ec"/><text x="60" y="74" font-family="Arial" font-size="42" font-weight="700" fill="#0f7a57" text-anchor="middle">${i}</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
};
const photoSvg = (cat) => {
  const cols = { "Fire safety": "#d6455a", "Electrical fault": "#2f6fd0", "Equipment / Maintenance": "#d9891c", Housekeeping: "#0f7a57", "Spillage / Environment": "#5d6b79" };
  const col = cols[cat] || "#5d6b79";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#eef2f6"/><rect x="28" y="28" width="104" height="104" rx="12" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="8 6"/><circle cx="80" cy="80" r="20" fill="${col}" opacity=".85"/></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
};

async function makeShift(guard, daysAgo, cover, obsSpec) {
  const start = new Date(); start.setDate(start.getDate() - daysAgo); start.setHours(22, 10, 0, 0);
  const startMs = start.getTime();
  const { rows } = await q(
    "INSERT INTO shifts (guard_name, face_img, started_at, ended_at, status) VALUES ($1,$2,$3,$4,'ended') RETURNING id",
    [guard, faceSvg(guard), startMs, startMs + cover * 3.4 * 60000 + 120000]
  );
  const shiftId = rows[0].id;
  for (let i = 0; i < cover; i++)
    await q("INSERT INTO scans (shift_id, checkpoint_code, scanned_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [shiftId, ROUTE[i].code, startMs + i * 3.4 * 60000]);
  for (const [code, cat, dept, remarks, status] of obsSpec) {
    const seqIdx = ROUTE.findIndex((c) => c.code === code);
    await q("INSERT INTO observations (shift_id, checkpoint_code, category, dept, remarks, photo, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [shiftId, code, cat, dept, remarks, photoSvg(cat), status || "Open", startMs + seqIdx * 3.4 * 60000]);
  }
  console.log(`Seeded patrol: ${guard} (${cover}/${ROUTE.length}, ${obsSpec.length} obs)`);
}

(async function run() {
  try {
    await init();
    if (process.argv.includes("--fresh")) {
      await q("DELETE FROM report_log; DELETE FROM observations; DELETE FROM scans; DELETE FROM shifts;");
      console.log("Cleared existing shifts, scans and observations.");
    }
    await makeShift("A. Kumar · SG-102", 1, 25, [
      ["BLR", "Equipment / Maintenance", "Utility & Maintenance", "Boiler pressure gauge glass fogged, reading unclear.", "Open"],
      ["FWT", "Fire safety", "Fire & Safety", "Fire water tank level indicator not illuminated.", "Open"],
      ["SCY", "Housekeeping", "Admin", "Scrap piled beyond marked bay, blocking walkway.", "Open"],
    ]);
    await makeShift("R. Sharma · SG-114", 2, 20, [
      ["ELR", "Electrical fault", "Electrical", "Panel room door lock not latching; found ajar.", "Acknowledged"],
      ["ETP", "Spillage / Environment", "Safety & EHS", "Minor oil sheen near STP inlet channel.", "Resolved"],
    ]);
    console.log("\nDone. Start the server with:  npm start");
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
