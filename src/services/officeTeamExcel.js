import { footerLine, monthName } from "./officeTeamReport.js";

// Builds the .xlsx the EA sends out: one worksheet per person, laid out like
// the month sheet Hagerstone already prints — the merged summary strip, the
// black divider, the day-by-day table, the footer line.
//
// ExcelJS is loaded with a dynamic import so it lands in its own lazy chunk.
// It is ~800 KB; bundling it into the main app would slow the first paint of
// every panel to pay for a button most sessions never press.
//
// The `bare` build is deliberate: the default browser bundle ships core-js
// polyfills for browsers this app never supported, and doubles the download.

const FILL = {
  head:      "FFF2F2F2",
  name:      "FFF2DCDB",
  workdays:  "FFD9D2E9",
  onTime:    "FFD9EAD3",
  late:      "FFD9D2E9",
  cl:        "FFD9EAD3",
  el:        "FFF4CCCC",
  sl:        "FFE6D9F2",
  hd:        "FFCFE2F3",
  ul:        "FF8B0000",
  absent:    "FFF4CCCC",
  holiday:   "FFDCE9F5",
  weekend:   "FFF7F5F0",
};

const THIN = { style: "thin", color: { argb: "FF9E9E9E" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

// Excel rejects [ ] : * ? / \ in a sheet name and truncates past 31 chars.
// Two people whose names collide after truncation would silently overwrite one
// another, so a counter is appended on collision.
function sheetName(name, used) {
  let base = String(name || "Employee").replace(/[\\/?*[\]:]/g, "-").slice(0, 31).trim() || "Employee";
  let out = base;
  for (let i = 2; used.has(out); i++) out = `${base.slice(0, 28)}~${i}`;
  used.add(out);
  return out;
}

function writeSheet(ws, report) {
  const h = report.header;

  ws.columns = [
    { width: 14 }, { width: 22 }, { width: 10 }, { width: 10 }, { width: 12 },
    { width: 11 }, { width: 11 }, { width: 9 },  { width: 13 }, { width: 34 },
    { width: 13 }, { width: 8 },
  ];

  // ── Summary strip ─────────────────────────────────────────────────────────
  const labels = [
    "", fmtDate(h.from), fmtDate(lastOf(report)), "Total Working Days", "On Time",
    "Late", "CL", "EL", "SL (Sick-leave)", "HD", "UL (Uninformed Leaves)", "SHL",
  ];

  const r1 = ws.getRow(1);
  labels.forEach((v, i) => { r1.getCell(i + 1).value = v; });
  const headFills = [FILL.name, null, null, FILL.workdays, FILL.onTime, FILL.late,
    FILL.cl, FILL.el, FILL.sl, FILL.hd, FILL.ul, null];
  for (let c = 1; c <= 12; c++) {
    const cell = r1.getCell(c);
    cell.font = { bold: true, size: 9, color: { argb: c === 11 ? "FFFFFFFF" : "FF000000" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER;
    cell.fill = solid(headFills[c - 1] || FILL.head);
  }
  r1.height = 30;

  const r2 = ws.getRow(2);
  r2.getCell(1).value = "Name";
  r2.getCell(2).value = h.name;
  ws.mergeCells(2, 2, 2, 3);
  const vals = [h.totalWorkingDays, h.onTime, h.late, h.cl, h.el, h.sl, h.hd, h.ul, h.shl];
  vals.forEach((v, i) => { r2.getCell(4 + i).value = v; });
  const valFills = [FILL.name, FILL.head, null, FILL.workdays, FILL.onTime, FILL.late,
    FILL.cl, FILL.el, FILL.sl, FILL.hd, null, null];
  for (let c = 1; c <= 12; c++) {
    const cell = r2.getCell(c);
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER;
    if (valFills[c - 1]) cell.fill = solid(valFills[c - 1]);
  }
  r2.height = 20;

  // The black divider the printed sheet uses to close the summary block.
  ws.mergeCells(3, 1, 3, 12);
  const band = ws.getRow(3);
  band.height = 12;
  for (let c = 1; c <= 12; c++) band.getCell(c).fill = solid("FF000000");

  // ── Day table ─────────────────────────────────────────────────────────────
  const HEAD = ["Date", "Name", "IN Time", "OUT Time", "Total Hours", "Over Time",
    "Status", "Leaves", "Weekend", "Remarks"];
  const HEAD_ROW = 5;
  const hr = ws.getRow(HEAD_ROW);
  HEAD.forEach((v, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = v;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER;
    cell.fill = solid(FILL.head);
  });
  hr.height = 26;

  report.rows.forEach((r, i) => {
    const row = ws.getRow(HEAD_ROW + 1 + i);
    row.getCell(1).value = r.dateLabel;
    row.getCell(2).value = r.name;
    row.getCell(3).value = r.inTime;
    row.getCell(4).value = r.outTime;
    // Numbers, not strings, so the EA can sum or chart a column in Excel.
    row.getCell(5).value = r.totalHours;
    row.getCell(6).value = r.overTime;
    row.getCell(7).value = r.status;
    row.getCell(8).value = r.leaves;
    row.getCell(9).value = r.weekend;
    row.getCell(10).value = r.remarks;

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.border = BORDER;
      cell.font = { size: 9 };
      cell.alignment = { horizontal: c === 10 ? "left" : "center", vertical: "middle" };
    }
    row.getCell(5).numFmt = "0.00";
    row.getCell(6).numFmt = "0.00";

    if (r.status === "On Time") row.getCell(7).fill = solid(FILL.onTime);
    if (r.status === "Absent") {
      row.getCell(7).fill = solid(FILL.absent);
      row.getCell(7).font = { size: 9, bold: true, color: { argb: "FFC00000" } };
    }
    if (r.status === "Holiday") row.getCell(7).fill = solid(FILL.holiday);
    if (r.leaves) {
      row.getCell(8).fill = solid(FILL.el);
      row.getCell(8).font = { size: 9, bold: true, color: { argb: "FFC00000" } };
    }
    if (r.isWeekOff) {
      row.getCell(9).font = { size: 9, bold: true };
      for (let c = 1; c <= 10; c++) if (!row.getCell(c).fill) row.getCell(c).fill = solid(FILL.weekend);
    }
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const footRow = HEAD_ROW + report.rows.length + 2;
  ws.mergeCells(footRow, 1, footRow, 10);
  const f = ws.getRow(footRow).getCell(1);
  f.value = footerLine(report);
  f.font = { size: 9, bold: true };
  f.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getRow(footRow).height = 22;

  // The summary strip stays visible while scrolling a 31-row month.
  ws.views = [{ state: "frozen", ySplit: HEAD_ROW }];
  ws.pageSetup = {
    orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  // Repeat the day-table header on every printed page.
  ws.pageSetup.printTitlesRow = `${HEAD_ROW}:${HEAD_ROW}`;
}

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return `${iso.slice(8, 10)} ${d.toLocaleDateString("en-GB", { month: "short" })} ${iso.slice(0, 4)}`;
};

// The last date the report actually covers. For the current month that is
// today, not the 31st — printing "01 Aug 2026 – 31 Aug 2026" on the 25th
// claims six days of data the report does not have.
const lastOf = (report) =>
  report.rows.length ? report.rows[report.rows.length - 1].date : report.header.from;

/**
 * Takes reports ALREADY built by buildReport — the panel has them on screen, so
 * rebuilding here would mean the download could differ from what the EA just
 * looked at.
 *
 * @param reports  output of buildReport(), one per person
 * @returns { blob, filename }
 */
export async function buildWorkbook({ reports }) {
  if (!reports?.length) throw new Error("nothing to export");
  const { default: ExcelJS } = await import("exceljs/dist/exceljs.bare.min.js");

  const wb = new ExcelJS.Workbook();
  wb.creator = "HireFlow — Hagerstone";
  wb.created = new Date();

  const used = new Set();
  for (const report of reports) {
    const ws = wb.addWorksheet(sheetName(report.header.name, used), {
      properties: { defaultRowHeight: 16 },
    });
    writeSheet(ws, report);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const label = monthName(reports[0].month).replace(/\s+/g, "_");
  const name = reports.length === 1
    ? `${reports[0].header.name.replace(/[^\w]+/g, "_")}_${label}_Attendance.xlsx`
    : `Office_Team_Attendance_${label}.xlsx`;

  return {
    blob: new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename: name,
  };
}

export function download({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoked on the next tick — revoking synchronously can beat the download in
  // Firefox and produce an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
