// ============================================================================
// import-hsipl-gap.mjs
//
// Fills the attendance COVERAGE GAP: 2026-07-31 .. 2026-08-11, the twelve days
// between the end of the original HSIPL import (2026-07-30) and the day the
// punch portal went live (2026-08-12).
//
// For those twelve days the system had no record of anyone, which is why
// 20260814074535_attendance_coverage_gap_blackout.sql had to suppress them
// outright — otherwise hr.attendance_day scored every one of them 'absent' and
// five employees carried up to ten fabricated absences each. The retired
// Google Sheet does cover them, so this reads the sheet's HTML export and
// writes the missing punches and leave rows.
//
//   node scripts/import-hsipl-gap.mjs <extracted-sheet-dir>            # dry run
//   node scripts/import-hsipl-gap.mjs <extracted-sheet-dir> --apply    # writes
//
// <extracted-sheet-dir> is the unzipped "Staff Attendance System (HSIPL)"
// export. The .zip is gitignored — it carries employee PII, including links to
// every timestamp selfie.
//
// WHY THIS WRITES OVER PostgREST RATHER THAN EMITTING SQL
// 550 punches and 36 leave rows is ~110 KB of INSERT statements. There is no
// SUPABASE_ACCESS_TOKEN and no direct database connection in this repo, so a
// generated migration would have to be retyped into the Supabase MCP tool by
// hand — the same silent-corruption risk CLAUDE.md documents for the
// assessment payload, where a single transposed row mis-marks a paper. Reading
// the rows off disk and POSTing them is byte-exact. The structural half of the
// change (the late cut-off, the identity merges, retiring the blackout) is
// small, reviewable SQL and lives in the migrations folder where it belongs.
//
// SAFE TO RE-RUN. Every row is checked against what is already in the window
// before it is written, so a second run inserts nothing.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const args    = process.argv.slice(2);
const SRC_DIR = args.find((a) => !a.startsWith("--"));
const APPLY   = args.includes("--apply");
if (!SRC_DIR) {
  console.error("usage: node scripts/import-hsipl-gap.mjs <extracted-sheet-dir> [--apply]");
  process.exit(2);
}

// The gap, inclusive. Do NOT widen past 2026-08-11: from the 12th the portal is
// the record of truth, and the sheet went on being filled in alongside it for
// another fortnight. Importing that overlap would double-count every day —
// e.g. Abhishek Jha's half-day on 13 Aug exists in both.
const GAP_FROM = "2026-07-31";
const GAP_TO   = "2026-08-11";

// ── The name map ────────────────────────────────────────────────────────────
// Sheet spelling → hub employee (by email — the only stable key, since
// employee_code is null for several people) or → hr.attendance_person roster
// row (by name).
//
// This is the one hand-made part of the import and the one place a mistake is
// unrecoverable: a wrong entry files a fortnight of one person's attendance
// under a colleague's name, and nothing downstream would ever flag it. An
// unmapped name is a hard error, never a skipped row.
//
// Reviewed and signed off by the EA on 2026-08-25. Two calls worth recording:
//   • Avisha — hr has two active records, HAG-010 (avijennet2001@gmail.com,
//     the one punching on the portal) and HAG-032 (procurement@hagerstone.com,
//     zero punches). Confirmed the same person; everything goes to HAG-010.
//     HAG-032 is a duplicate, but public.employees is read-only from this repo
//     (CLAUDE.md rule 1), so retiring it needs someone with hub access.
//   • Ritu — the sheet's "Ritu" and "Ritu Bhatt" are two different people.
//     "Ritu" is Ritu Ma'am (HAG-037). "Ritu Bhatt" has no hub account and
//     stays a roster person. Neither is Ritu Sharma (HAG-018, the EA login),
//     who has no attendance of any kind.
export const NAME_MAP = {
  // ── office team: on the live portal, and shown in the EA panel ────────────
  "Abhishek Jha":           { email: "aj1893372@gmail.com" },                              // HAG-003
  "Ajit Singh":             { email: "ajitreddy916@gmail.com",      merge: "Ajit Singh" },  // HAG-004
  "Aniket":                 { email: "aniketawasthi.work@gmail.com" },                     // no code
  "Avisha":                 { email: "avijennet2001@gmail.com",     merge: "Avisha" },      // HAG-010
  "Deepak Bansal":          { email: "dba88795@gmail.com" },                               // HAG-071
  "Fardeen":                { email: "fardeenkhan77556556@gmail.com", merge: "Fardeen" },  // HAG-020
  "Kushal Singh":           { email: "skushal274@gmail.com" },                             // HAG-048
  "Ritu":                   { email: "ritudesaiwal@gmail.com",      merge: "Ritu" },        // HAG-037
  "Saksham":                { email: "sakshamkaloya109@gmail.com",  merge: "Saksham" },     // no code
  "Sapna Rahi":             { email: "sapnarahi12@gmail.com",       merge: "Sapna Rahi" },  // HAG-042
  "Shivani":                { email: "carrers@hagerstone.com" },                           // HAG-011
  "Vipin":                  { email: "vipinjha7011@gmail.com",      merge: "Vipin" },       // HAG-051, spelt "Bipin" in the hub
  "Yash Kumar Sharma":      { email: "yyashkumar8@gmail.com" },                            // HAG-056
  "Yogesh Kumar Singh":     { email: "ys11c60@gmail.com",           merge: "Yogesh Kumar Singh" }, // HAG-054

  // ── everyone else in the sheet: stored, but not in the office-team panel ──
  "Akhilesh Gupta":         { email: "guptaakhilesh886@gmail.com" },   // HAG-023
  "Amit Choudhary":         { email: "amitsingh151980@gmail.com" },    // HAG-007
  "Arman ali":              { email: "farmanali9540@gmail.com" },      // HAG-021
  "Dilip parashar":         { email: "dilipparashar45@gmail.com" },    // HAG-015
  "Divyansh":               { email: "divyansh@hagerstone.com" },      // HAG-017
  "Kapil Gautam":           { email: "kapilraj419@gmail.com" },        // no code
  "Raj Kumar Gupta":        { email: "rajgupta2814@gmail.com" },       // HAG-034
  "Rishabh Singh":          { email: "rishabhsingh401@gmail.com" },    // HAG-036
  "Salman Khan":            { email: "sohilkhan.sk296@gmail.com" },    // HAG-070
  "Sanjeev Kumar Upadhyay": { email: "svpsanjeev@gmail.com" },         // HAG-050
  "Shubham":                { email: "rajputshubham19191@gmail.com" }, // HAG-069
  "Tara Chandra":           { email: "tsbaghel1991@gmail.com" },       // HAG-072
  "Vikas Kumar Singh":      { email: "vikasksingh029@gmail.com" },     // HAG-067
  "Vimal Kumar":            { email: "vimalkumarsingh09@gmail.com" },  // no code

  // Roster-only: no hub account, so they stay hr.attendance_person. Left
  // deliberately unlinked — "Akhil Tyagi" vs HAG-005 "Akhil", "Hari Shankar"
  // vs HAG-024 "Harishankar Tiwari" and "Shubh" vs HAG-045 "Shubh Dwivedi" are
  // all plausible but unconfirmed, and a wrong link welds two people together.
  "Akhil Tyagi":            { roster: "Akhil Tyagi" },
  "Grish kumar":            { roster: "Grish kumar" },
  "Hari Shankar":           { roster: "Hari Shankar" },
  "Jagmohan":               { roster: "Jagmohan" },
  "Ritu Bhatt":             { roster: "Ritu Bhatt" },
  "Rohit Sharma":           { roster: "Rohit Sharma" },
  "Rohit Sharma 2":         { roster: "Rohit Sharma 2" },
  "Shivam":                 { roster: "Shivam" },
  "Shubh":                  { roster: "Shubh" },

  // In the sheet but nowhere in the system. Created by the companion migration
  // 20260825120000, which must run before this script.
  "Kanhaiya kumar":         { roster: "Kanhaiya kumar" },
  "Samad khan":             { roster: "Samad khan" },
};

const LEAVE_CODE = {
  CL:  { type: "casual",      fixedDays: null },
  EL:  { type: "emergency",   fixedDays: null },
  SL:  { type: "sick",        fixedDays: null },
  HD:  { type: "half_day",    fixedDays: 0.5 },
  SHL: { type: "short_leave", fixedDays: 0.25 },
};

// ── env ─────────────────────────────────────────────────────────────────────
function env() {
  const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
  const get = (k) => (raw.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim();
  const url = get("VITE_SUPABASE_URL");
  const key = get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env");
  return { url: url.replace(/\/+$/, ""), key };
}

// PostgREST against the `hr` schema. The service-role key bypasses RLS by
// design (CLAUDE.md rule 4) — this script is the authorisation boundary, which
// is why it refuses to write anything outside the gap window.
async function rest(method, pathAndQuery, { body, schema = "hr", prefer } = {}) {
  const { url, key } = env();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Accept-Profile": schema,
    "Content-Profile": schema,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function page(table, query, schema = "hr") {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await rest("GET", `${table}?${query}&limit=1000&offset=${from}`, { schema });
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

// ── HTML table reader ───────────────────────────────────────────────────────
// A Google Sheets HTML export is one <table> per tab. Column 0 is the sheet's
// row-number gutter, so real data starts at column 1.
function readRows(file) {
  const html = fs.readFileSync(file, "utf8");
  const decode = (s) =>
    s.replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, " ").trim();
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(c[1]))
  );
}

// ── Punches: the "Attendance Form" tab ──────────────────────────────────────
// Timestamp is dd/mm/yyyy HH:MM:SS and is always IST — the Google Form carried
// no timezone, and the whole attendance model is IST-day based.
function readPunches() {
  const out = [];
  for (const r of readRows(path.join(SRC_DIR, "Attendance Form.html")).slice(2)) {
    const ts = r[1] || "";
    if (!/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(ts)) continue;
    const [d, m, y] = ts.slice(0, 10).split("/");
    const date = `${y}-${m}-${d}`;
    if (date < GAP_FROM || date > GAP_TO) continue;
    const io = (r[4] || "").trim().toUpperCase();
    if (io !== "IN" && io !== "OUT") continue;
    out.push({
      name: (r[2] || "").trim(),
      recorded_at: `${date}T${ts.slice(11)}+05:30`,
      time: ts.slice(11),
      type: io === "IN" ? "check_in" : "check_out",
      site_name: (r[3] || "").trim() || null,
      photo_url: (r[5] || "").trim() || null,
    });
  }
  return out;
}

// ── Leave: the "Leave Data" tab ─────────────────────────────────────────────
// Start Date is M/D/YYYY, End Date is D/M/YYYY. The two columns genuinely
// disagree in the sheet — row 2 reads "7/3/2025 | 03/07/2025" — so each is
// parsed with its own format rather than one guessed for both.
function readLeave() {
  const mdy = (s) => { const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}` : null; };
  const dmy = (s) => { const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : null; };
  const out = [];
  for (const r of readRows(path.join(SRC_DIR, "Leave Data.html")).slice(2)) {
    const name  = (r[1] || "").trim();
    const start = mdy(r[2]);
    const code  = (r[4] || "").trim().toUpperCase();
    if (!name || !start || !LEAVE_CODE[code]) continue;
    let end = dmy(r[3]) || start;
    if (end < start) end = start;                       // a few rows have the pair reversed
    // Clip to the gap, so a sheet leave and a portal leave can never both be
    // counted for the same day.
    const from = start < GAP_FROM ? GAP_FROM : start;
    const to   = end   > GAP_TO   ? GAP_TO   : end;
    if (to < GAP_FROM || from > GAP_TO || from > to) continue;
    const span = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
    out.push({
      name, code,
      leave_type: LEAVE_CODE[code].type,
      start_date: from, end_date: to,
      total_days: LEAVE_CODE[code].fixedDays ?? span,
      clipped: end > GAP_TO,
    });
  }
  return out;
}

// ── Run ─────────────────────────────────────────────────────────────────────
const punches = readPunches();
const leave   = readLeave();

const unmapped = new Set();
for (const p of punches) if (!NAME_MAP[p.name]) unmapped.add(`punch  ${p.name}`);
for (const l of leave)   if (!NAME_MAP[l.name]) unmapped.add(`leave  ${l.name}`);
if (unmapped.size) {
  console.error("REFUSING TO IMPORT — these sheet names are not in NAME_MAP:\n");
  for (const u of [...unmapped].sort()) console.error("  " + u);
  console.error("\nAdd each one with an explicit target. Never guess: a wrong entry");
  console.error("files one person's attendance under another person's name.");
  process.exit(1);
}

console.log(`sheet     ${punches.length} punches, ${leave.length} leave rows in ${GAP_FROM}..${GAP_TO}`);

const [employees, roster, sites] = await Promise.all([
  page("employees", "select=id,email,name,is_active", "public"),
  page("attendance_person", "select=id,full_name,employee_id"),
  page("sites", "select=id,name"),
]);
const byEmail  = new Map(employees.map((e) => [String(e.email || "").toLowerCase(), e]));
const byRoster = new Map(roster.map((p) => [p.full_name, p]));
const bySite   = new Map(sites.map((s) => [s.name, s.id]));

// Resolve every sheet name to exactly one subject, up front, and refuse the
// whole run if any of them cannot be resolved. A half-applied import is far
// worse than none: the gap would be closed for some people and not others.
const subject = new Map();
for (const [sheetName, t] of Object.entries(NAME_MAP)) {
  if (t.email) {
    const e = byEmail.get(t.email.toLowerCase());
    if (!e) { console.error(`unresolved employee for "${sheetName}": ${t.email}`); process.exit(1); }
    subject.set(sheetName, { employee_id: e.id, person_ref: null, label: e.name });
  } else {
    const p = byRoster.get(t.roster);
    if (!p) { console.error(`unresolved roster row for "${sheetName}": ${t.roster}\n  → run migration 20260825120000 first, it creates the missing ones.`); process.exit(1); }
    // A linked roster row is no longer its own subject (hr.attendance_subject
    // drops it), so anything landing here must go to the employee instead.
    subject.set(sheetName, p.employee_id
      ? { employee_id: p.employee_id, person_ref: null, label: `${t.roster} → linked` }
      : { employee_id: null, person_ref: p.id, label: t.roster });
  }
}

// What is already in the window, so a re-run is a no-op.
const existingPunch = new Set(
  (await page("attendance", `select=employee_id,person_ref,type,recorded_at&recorded_at=gte.${GAP_FROM}T00:00:00%2B05:30&recorded_at=lt.2026-08-12T00:00:00%2B05:30`))
    .map((a) => `${a.employee_id || a.person_ref}|${a.type}|${new Date(a.recorded_at).toISOString()}`)
);
const existingLeave = new Set(
  (await page("leave_requests", `select=employee_id,person_ref,leave_type,start_date,end_date&start_date=lte.${GAP_TO}&end_date=gte.${GAP_FROM}`))
    .map((l) => `${l.employee_id || l.person_ref}|${l.leave_type}|${l.start_date}|${l.end_date}`)
);

const punchRows = [];
for (const p of punches) {
  const s = subject.get(p.name);
  const key = `${s.employee_id || s.person_ref}|${p.type}|${new Date(p.recorded_at).toISOString()}`;
  if (existingPunch.has(key)) continue;
  existingPunch.add(key);                                 // the sheet has exact duplicate rows
  punchRows.push({
    employee_id: s.employee_id, person_ref: s.person_ref,
    type: p.type, recorded_at: p.recorded_at,
    site_name: p.site_name, site_ref: bySite.get(p.site_name) ?? null,
    photo_url: p.photo_url, source: "import",
    // Decorative: hr.attendance_day recomputes day_status from late_after.
    // Kept agreeing with the 09:30 cut-off the companion migration sets.
    status: p.type === "check_in" && p.time > "09:30:00" ? "late" : "present",
    location_verified: false,
  });
}

const leaveRows = [];
for (const l of leave) {
  const s = subject.get(l.name);
  const key = `${s.employee_id || s.person_ref}|${l.leave_type}|${l.start_date}|${l.end_date}`;
  if (existingLeave.has(key)) continue;
  existingLeave.add(key);
  leaveRows.push({
    employee_id: s.employee_id, person_ref: s.person_ref,
    leave_type: l.leave_type, reason: `Imported from HSIPL sheet (${l.code})`,
    start_date: l.start_date, end_date: l.end_date,
    total_days: l.total_days, paid_days: 0, unpaid_days: 0,
    status: "approved", source: "import",
  });
}

console.log(`resolved  ${subject.size} names -> ${new Set([...subject.values()].map((s) => s.employee_id || s.person_ref)).size} subjects`);
console.log(`to write  ${punchRows.length} punches, ${leaveRows.length} leave rows`);
console.log(`skipped   ${punches.length - punchRows.length} punches, ${leave.length - leaveRows.length} leave rows (already present or duplicated in the sheet)`);

const clipped = leave.filter((l) => l.clipped);
if (clipped.length) {
  console.log(`\nclipped at ${GAP_TO} — the tail belongs to the portal, not the sheet:`);
  for (const l of clipped) console.log(`  ${l.name} ${l.code} from ${l.start_date}`);
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.");
  process.exit(0);
}

for (let i = 0; i < punchRows.length; i += 200) {
  await rest("POST", "attendance", { body: punchRows.slice(i, i + 200), prefer: "return=minimal" });
  console.log(`  punches ${Math.min(i + 200, punchRows.length)}/${punchRows.length}`);
}
if (leaveRows.length) {
  await rest("POST", "leave_requests", { body: leaveRows, prefer: "return=minimal" });
  console.log(`  leave   ${leaveRows.length}/${leaveRows.length}`);
}
console.log("\ndone. Now apply 20260825130000 to retire the coverage-gap blackout.");
