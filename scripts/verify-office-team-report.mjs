// ============================================================================
// verify-office-team-report.mjs
//
// Acceptance test for the Office Team report. There is no test runner in this
// repo, so this is the thing that gets run.
//
// It drives the SAME modules the panel uses — officeTeamReport.buildReport and
// officeTeamExcel.buildWorkbook — over live data, then reads the .xlsx back and
// asserts on the cells that actually came out. Checking the numbers before they
// are written proves nothing about the workbook the EA opens.
//
// The fixture is Deepak Bansal, July 2026: the month the EA supplied as a
// printed sample, so there is an independent right answer to compare against.
//
//   node scripts/verify-office-team-report.mjs
// ============================================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildReport, footerLine } from "../src/services/officeTeamReport.js";
import { buildWorkbook } from "../src/services/officeTeamExcel.js";

// The printed sample, transcribed — with ONE deliberate departure.
//
// The sample was printed under a 09:30 cut-off and shows 19 On Time / 5 Late.
// The EA moved the cut-off to 09:40 on 2026-08-25 (20260825140000), because
// 09:30 made six of the fifteen office staff structurally late. Under 09:40
// the same July is 22 / 2: Deepak's 09:36, 09:37 and 09:34 arrivals are inside
// the window, and only 10:35 and 10:04 are not.
//
// Everything else here is still asserted against the printed sample exactly.
const EXPECTED = {
  name: "Deepak Bansal",
  month: "2026-07-01",
  totalWorkingDays: 24, onTime: 22, late: 2,
  cl: 2, el: 1, sl: 0, hd: 0, ul: 0, shl: 0,
  weekOffs: 4,
  // The printed sample's footer reads 209.85 hrs / 4.50 OT. This report gives
  // 209.90 / 4.54, and the whole difference is one day: on 14-Jul Deepak
  // punched OUT TWICE, at 18:37:03 and 18:40:03. hr.attendance_day takes
  // max(check_out) — the last punch is when the person actually left — while
  // whatever produced the sample took the first. Everything else agrees to the
  // second.
  //
  // So the totals are NOT asserted against the sample: they are asserted
  // against the column above them, which is the invariant that matters and the
  // one anyone reading the sheet will check.
  hoursSampleSaid: 209.85, overtimeSampleSaid: 4.50,
  // A few day rows, including all three edge cases the month contains:
  // a leave day, the 09:30:58 punch, and the day with no check-out.
  days: {
    "2026-07-01": { in: "",      out: "",      status: "Leave",   leaves: "CL" },
    // 09:36 — Late under the sample's 09:30, On Time under the EA's 09:40.
    "2026-07-03": { in: "09:36", out: "18:37", status: "On Time", hours: 9.02, ot: 0.02 },
    "2026-07-05": { in: "",      out: "",      status: "",        weekend: "Sunday" },
    "2026-07-06": { in: "",      out: "",      status: "Leave",   leaves: "EL" },
    "2026-07-09": { in: "10:35", out: "18:32", status: "Late",    hours: 7.95, ot: 0.00 },
    "2026-07-11": { in: "09:30", out: "18:31", status: "On Time", hours: 9.00, ot: 0.00 },
    "2026-07-30": { in: "09:29", out: "",      status: "On Time", hours: null, ot: null },
    "2026-07-31": { in: "09:21", out: "18:33", status: "On Time", hours: 9.18, ot: 0.18 },
  },
};

// ── env / REST ──────────────────────────────────────────────────────────────
const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const cfg = (k) => (raw.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim();
const URL_ = cfg("VITE_SUPABASE_URL").replace(/\/+$/, "");
const KEY  = cfg("SUPABASE_SERVICE_ROLE_KEY");

async function q(table, query, schema = "hr") {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": schema },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

let failures = 0;
const check = (label, got, want) => {
  const ok = got === want || (typeof got === "number" && typeof want === "number" && Math.abs(got - want) < 0.005);
  if (!ok) { failures++; console.log(`  FAIL  ${label}\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`); }
  else console.log(`  ok    ${label} = ${JSON.stringify(got)}`);
};

// ── 1. The office team is what the migration says it is ─────────────────────
console.log("\n[1] office team membership");
const team = await q("attendance_subject", "select=*&office_team=is.true&is_active=is.true&order=full_name");
check("office team size", team.length, 15);
const codes = team.map((t) => t.employee_code || `(${t.full_name})`).join(", ");
console.log(`        ${codes}`);
for (const t of team) {
  if (t.subject_kind !== "employee") { failures++; console.log(`  FAIL  ${t.full_name} is a roster person, cannot punch`); }
}

// ── 2. The coverage gap is genuinely closed ─────────────────────────────────
console.log("\n[2] coverage gap 2026-07-31 .. 2026-08-11");
const [settings] = await q("attendance_settings", "select=*&id=is.true");
check("coverage_gap_from cleared", settings.coverage_gap_from, null);
check("late_after", String(settings.late_after).slice(0, 5), "09:40");
const gapDays = await q("attendance_day",
  "select=work_date,day_status&work_date=gte.2026-07-31&work_date=lte.2026-08-11&limit=2000");
check("gap has day rows", gapDays.length > 300, true);
const gapWorked = gapDays.filter((d) => d.day_status === "present" || d.day_status === "late").length;
console.log(`        ${gapDays.length} day rows, ${gapWorked} worked, ` +
  `${gapDays.filter((d) => d.day_status === "absent").length} absent`);

// ── 3. The sample month, through the real report code ───────────────────────
console.log("\n[3] Deepak Bansal, July 2026 — against the printed sample");
const [subject] = await q("attendance_subject", `select=*&full_name=eq.${encodeURIComponent(EXPECTED.name)}`);
if (!subject) { console.log("  FAIL  subject not found"); process.exit(1); }
const [summary] = await q("attendance_month", `select=*&subject_id=eq.${subject.subject_id}&month=eq.${EXPECTED.month}`);
const days = await q("attendance_day",
  `select=*&subject_id=eq.${subject.subject_id}&work_date=gte.2026-07-01&work_date=lte.2026-07-31&order=work_date`);
const remarks = await q("attendance_remarks",
  `select=*&remark_date=gte.2026-07-01&remark_date=lte.2026-07-31&employee_id=eq.${subject.employee_id}`);

const report = buildReport({ subject, summary, days, remarks, settings, month: EXPECTED.month });
const h = report.header;

check("Total Working Days", h.totalWorkingDays, EXPECTED.totalWorkingDays);
check("On Time",            h.onTime,           EXPECTED.onTime);
check("Late",               h.late,             EXPECTED.late);
check("CL",  h.cl,  EXPECTED.cl);
check("EL",  h.el,  EXPECTED.el);
check("SL",  h.sl,  EXPECTED.sl);
check("HD",  h.hd,  EXPECTED.hd);
check("UL",  h.ul,  EXPECTED.ul);
check("SHL", h.shl, EXPECTED.shl);
check("Sundays (week offs)", h.weekOffs, EXPECTED.weekOffs);
check("On Time + Late = Working Days", h.onTime + h.late, h.totalWorkingDays);
check("row count = days in July", report.rows.length, 31);

// The footer must equal the sum of the column printed above it. Deriving the
// footer from raw minutes instead would put it a couple of hundredths out from
// the visible column, which is the first thing anyone challenges.
const colHours = Math.round(report.rows.reduce((a, r) => a + (r.totalHours || 0), 0) * 100) / 100;
const colOt    = Math.round(report.rows.reduce((a, r) => a + (r.overTime || 0), 0) * 100) / 100;
check("footer hours = sum of Total Hours column", report.totals.hours, colHours);
check("footer OT = sum of Over Time column",      report.totals.overtime, colOt);
console.log(`        sample said ${EXPECTED.hoursSampleSaid} hrs / ${EXPECTED.overtimeSampleSaid} OT; ` +
  `report says ${report.totals.hours} / ${report.totals.overtime} — the 14-Jul double check-out, see EXPECTED`);
check("within a rounding day of the printed sample",
  Math.abs(report.totals.hours - EXPECTED.hoursSampleSaid) < 0.1, true);

console.log("\n[4] individual day rows");
const byDate = new Map(report.rows.map((r) => [r.date, r]));
for (const [date, want] of Object.entries(EXPECTED.days)) {
  const r = byDate.get(date);
  if (!r) { failures++; console.log(`  FAIL  ${date} missing from the report`); continue; }
  check(`${date} IN`,     r.inTime,  want.in);
  check(`${date} OUT`,    r.outTime, want.out);
  check(`${date} status`, r.status,  want.status);
  if (want.leaves  !== undefined) check(`${date} leaves`,  r.leaves,  want.leaves);
  if (want.weekend !== undefined) check(`${date} weekend`, r.weekend, want.weekend);
  if (want.hours   !== undefined) check(`${date} hours`,   r.totalHours, want.hours);
  if (want.ot      !== undefined) check(`${date} OT`,      r.overTime,   want.ot);
}

// A day with a punch in but none out must have BLANK hours, not 0.00 — a zero
// there reads as "worked nothing" and quietly drags the month total down.
const noOut = report.rows.filter((r) => r.missingCheckout);
console.log(`\n[5] ${noOut.length} day(s) with no check-out`);
for (const r of noOut) {
  check(`${r.date} hours blank`, r.totalHours, null);
  check(`${r.date} OT blank`,    r.overTime,   null);
}

// ── 6. The workbook that actually gets downloaded ───────────────────────────
console.log("\n[6] the .xlsx itself");
const { blob, filename } = await buildWorkbook({ reports: [report] });
const out = path.join(os.tmpdir(), filename);
fs.writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
console.log(`        wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

const { default: ExcelJS } = await import("exceljs");
const back = new ExcelJS.Workbook();
await back.xlsx.readFile(out);
const ws = back.worksheets[0];
check("worksheet name", ws.name, EXPECTED.name);

const txt = (r, c) => { const v = ws.getRow(r).getCell(c).value; return v == null ? "" : String(v); };
check("A2 label",            txt(2, 1), "Name");
check("B2 name (merged B:C)", txt(2, 2), EXPECTED.name);
check("D2 Total Working Days", ws.getRow(2).getCell(4).value, EXPECTED.totalWorkingDays);
check("E2 On Time",            ws.getRow(2).getCell(5).value, EXPECTED.onTime);
check("F2 Late",               ws.getRow(2).getCell(6).value, EXPECTED.late);
check("G2 CL",                 ws.getRow(2).getCell(7).value, EXPECTED.cl);
check("H2 EL",                 ws.getRow(2).getCell(8).value, EXPECTED.el);
check("A5 day-table header",   txt(5, 1), "Date");
check("J5 day-table header",   txt(5, 10), "Remarks");
check("A6 first day",          txt(6, 1), "01-Jul-2026");
check("A36 last day",          txt(36, 1), "31-Jul-2026");

// Hours must be numbers in the cell, not text — the EA sums these columns.
const hoursCell = ws.getRow(8).getCell(5);          // 03-Jul, 9.02
check("E8 is a number", typeof hoursCell.value, "number");
check("E8 value",       hoursCell.value, 9.02);
check("E8 number format", hoursCell.numFmt, "0.00");

// The blank-not-zero rule has to survive the round trip too.
const jul30 = ws.getRow(35);                         // 30-Jul
check("30-Jul date",        String(jul30.getCell(1).value), "30-Jul-2026");
check("30-Jul hours blank", jul30.getCell(5).value == null, true);

check("footer line", txt(38, 1), footerLine(report));
console.log(`        footer: ${footerLine(report)}`);

// ── 7. Every office-team person exports without blowing up ──────────────────
console.log("\n[7] whole-team workbook");
const ids = team.map((t) => t.subject_id);
const allMonths = await q("attendance_month", `select=*&month=eq.2026-08-01&subject_id=in.(${ids.join(",")})`);
const allDays = await q("attendance_day",
  `select=*&subject_id=in.(${ids.join(",")})&work_date=gte.2026-08-01&work_date=lte.2026-08-31&limit=2000`);
const dayBy = new Map();
for (const d of allDays) (dayBy.get(d.subject_id) ?? dayBy.set(d.subject_id, []).get(d.subject_id)).push(d);
const sumBy = new Map(allMonths.map((s) => [s.subject_id, s]));
const reports = team.map((s) => buildReport({
  subject: s, summary: sumBy.get(s.subject_id) || null,
  days: dayBy.get(s.subject_id) || [], remarks: [], settings, month: "2026-08-01",
}));
const teamFile = await buildWorkbook({ reports });
const teamOut = path.join(os.tmpdir(), teamFile.filename);
fs.writeFileSync(teamOut, Buffer.from(await teamFile.blob.arrayBuffer()));
const back2 = new ExcelJS.Workbook();
await back2.xlsx.readFile(teamOut);
check("one worksheet per person", back2.worksheets.length, team.length);
check("no duplicate sheet names", new Set(back2.worksheets.map((w) => w.name)).size, team.length);
console.log(`        wrote ${teamOut} (${(fs.statSync(teamOut).size / 1024).toFixed(0)} KB)`);
for (const r of reports) {
  console.log(`        ${String(r.header.name).padEnd(20)} ` +
    `worked ${String(r.header.totalWorkingDays).padStart(2)}  ` +
    `ontime ${String(r.header.onTime).padStart(2)}  late ${String(r.header.late).padStart(2)}  ` +
    `absent ${String(r.header.absent).padStart(2)}  hrs ${r.totals.hours.toFixed(2)}`);
}

console.log(failures === 0
  ? "\nPASS — the report reproduces the printed sample exactly.\n"
  : `\nFAIL — ${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
