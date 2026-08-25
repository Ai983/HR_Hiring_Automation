// One place that turns raw hr.attendance_day rows into the month-sheet shape:
// the summary strip, a row per calendar date, and the footer line.
//
// The on-screen table and the Excel export BOTH read from here. They looked
// identical when they were written separately too — right up until one of them
// changed and nobody noticed the EA was reading different numbers on screen
// from the ones she was emailing out.

export const LEAVE_CODE = {
  casual: "CL",
  emergency: "EL",
  sick: "SL",
  half_day: "HD",
  short_leave: "SHL",
  uninformed: "UL",
};

const IST = "Asia/Kolkata";

/** HH:MM in IST. Never the browser's local time — work_date is an IST day. */
export function istTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-GB", {
    timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/** "01-Jul-2026", the sheet's own date format. */
export function reportDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const mon = d.toLocaleDateString("en-GB", { month: "short" });
  return `${iso.slice(8, 10)}-${mon}-${iso.slice(0, 4)}`;
}

const weekdayOf = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long" });

/** Decimal hours to 2dp, the unit the sheet reports in (9h11m -> 9.18). */
const hours = (min) => (min == null ? null : Math.round((min / 60) * 100) / 100);

/**
 * Is this punch late?
 *
 * Compared at MINUTE granularity against attendance_settings.late_after,
 * exactly as hr.attendance_day does it — 09:30:58 is on time, 09:31:00 is
 * late. Anything else and a day reads Late on screen and On Time in the
 * database, or the other way round.
 *
 * The threshold is never hardcoded here: it comes from settings, so changing
 * it in Attendance Setup moves the report with it.
 */
function isLate(inAt, lateAfter) {
  if (!inAt || !lateAfter) return false;
  return istTime(inAt) > String(lateAfter).slice(0, 5);
}

/**
 * @param subject  a row from hr.attendance_subject
 * @param summary  the matching hr.attendance_month row, or null
 * @param days     hr.attendance_day rows for the month, any order
 * @param remarks  hr.attendance_remarks rows for the month
 * @param settings hr.attendance_settings (for late_after)
 * @param month    "YYYY-MM-01"
 */
export function buildReport({ subject, summary, days, remarks = [], settings, month }) {
  const byDate = new Map(remarks.map((r) => [r.remark_date, r.remark]));
  const lateAfter = settings?.late_after;

  // Rows are exactly what hr.attendance_day holds — no invented dates.
  // If neither the portal nor the sheet has anything for a day, the report says
  // nothing about that day rather than guessing. A person who recorded
  // attendance in neither place simply has a shorter month, and that is the
  // truthful answer.
  const rows = [...days]
    .sort((a, b) => a.work_date.localeCompare(b.work_date))
    .map((d) => {
      const code = LEAVE_CODE[d.leave_type] || "";
      // Punched out but never in still means they were here. hr.attendance_day
      // scores that 'present' for the same reason.
      const attended = !!(d.in_at || d.out_at);

      // A half-day or short-leave day is still a day the person turned up, so
      // it keeps an On Time / Late verdict and the code moves to the Leaves
      // column. hr.attendance_day overwrites day_status with the leave type on
      // those rows, which is why the verdict is recomputed here rather than
      // read off day_status.
      let status;
      if (d.day_status === "holiday") status = "Holiday";
      else if (d.day_status === "week_off") status = "";
      // No in-time means nothing to compare against late_after, so never Late.
      else if (d.in_at) status = isLate(d.in_at, lateAfter) ? "Late" : "On Time";
      else if (attended) status = "On Time";
      else if (d.leave_type) status = "Leave";
      else status = "Absent";

      return {
        date: d.work_date,
        dateLabel: reportDate(d.work_date),
        name: subject.full_name,
        inTime: istTime(d.in_at),
        outTime: istTime(d.out_at),
        // A day with a check-in but no check-out has no measurable duration.
        // Blank, never zero: zero reads as "worked nothing" and drags the
        // month total down for what is really a missing punch.
        totalHours: hours(d.worked_minutes),
        overTime: d.in_at && d.out_at ? hours(d.ot_minutes ?? 0) : null,
        status,
        leaves: code,
        weekend: d.day_status === "week_off" ? weekdayOf(d.work_date) : "",
        remarks: [
          byDate.get(d.work_date) || "",
          d.day_status === "holiday" ? d.holiday_name : "",
          d.in_at && !d.out_at ? "No check-out recorded" : "",
          d.out_at && !d.in_at ? "No check-in recorded" : "",
        ].filter(Boolean).join(" · "),
        missingCheckout: !!d.in_at && !d.out_at,
        missingCheckin: !!d.out_at && !d.in_at,
        isWeekOff: d.day_status === "week_off",
        isHoliday: d.day_status === "holiday",
        isLate: attended && isLate(d.in_at, lateAfter),
        attended,
      };
    });

  // Footer totals add up the DISPLAYED daily figures rather than re-deriving
  // from raw minutes, so the column visibly sums to the number under it. The
  // two differ by a couple of hundredths — summing rounded values is not the
  // same as rounding a sum — and a total that does not match the column above
  // it is the first thing anyone challenges.
  const sum = (k) => Math.round(rows.reduce((a, r) => a + (r[k] || 0), 0) * 100) / 100;

  const s = summary || {};
  return {
    month,
    subject,
    header: {
      from: `${month.slice(0, 7)}-01`,
      name: subject.full_name,
      employeeCode: subject.employee_code || "",
      totalWorkingDays: s.days_worked ?? rows.filter((r) => r.attended).length,
      onTime: s.on_time ?? rows.filter((r) => r.attended && !r.isLate).length,
      late: s.late ?? rows.filter((r) => r.isLate).length,
      cl: s.cl ?? 0, el: s.el ?? 0, sl: s.sl ?? 0,
      hd: s.hd ?? 0, ul: s.ul ?? 0, shl: s.shl ?? 0,
      absent: s.absent ?? rows.filter((r) => r.status === "Absent").length,
      weekOffs: s.week_offs ?? rows.filter((r) => r.isWeekOff).length,
      missingCheckouts: rows.filter((r) => r.missingCheckout).length,
    },
    rows,
    totals: { hours: sum("totalHours"), overtime: sum("overTime") },
  };
}

/** The single-line summary the sheet prints under the table. */
export function footerLine(report) {
  const h = report.header;
  return [
    `Employee: ${h.name}`,
    `Month: ${monthName(report.month)}`,
    `Present: ${h.totalWorkingDays} days`,
    `CL: ${h.cl}  EL: ${h.el}  SL: ${h.sl}  UL: ${h.ul}`,
    `Sundays (Weekly Off): ${h.weekOffs}`,
    `Total Hours Worked: ${report.totals.hours.toFixed(2)} hrs`,
    `Total Overtime: ${report.totals.overtime.toFixed(2)} hrs`,
  ].join("  |  ");
}

export const monthName = (iso) =>
  new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
