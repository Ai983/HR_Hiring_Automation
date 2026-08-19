import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchAttendanceDays, fetchAttendanceMonth, istDate } from "../../services/attendanceService.js";

// ─────────────────────────────────────────────────────────────────────────────
// One month of attendance for ONE person: summary tiles + a day-by-day list.
//
// Used in two places with the same code:
//   • the employee portal ("My Attendance") — read-only, own record
//   • the admin app (per-employee drill-down) — read-only, anyone
//
// There is no `readOnly` prop and no role check here on purpose. RLS already
// decides what comes back: hr.attendance is scoped to
// (employee_id = hr.my_employee_id() OR hr.is_hr_admin()), and the views over
// it are security_invoker. An employee asking for someone else's subject_id
// gets an empty result from Postgres, not a hidden button. Keep it that way.
//
// Styles are inline because this renders inside two different shells (the
// portal's `ap-*` CSS and the admin app's `card` CSS) and must not inherit
// either one's look.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  ink: "#1a1612", mute: "#8a7e72", faint: "#b0a898",
  line: "#e8e2d9", soft: "#faf8f5", card: "#fff",
  green: "#16a34a", amber: "#b45309", red: "#dc2626", blue: "#0369a1", purple: "#7c3aed",
};

// Every value hr.attendance_day.day_status can hold. Leave types come through
// as the type itself (sick/casual/…), not a generic "on_leave", so each needs a
// label — an unmapped one falls through and shows the raw column value.
const DAY_BADGE = {
  present:     { label: "Present",    bg: "rgba(34,197,94,0.10)",  color: C.green },
  late:        { label: "Late",       bg: "rgba(245,158,11,0.12)", color: C.amber },
  absent:      { label: "Absent",     bg: "rgba(239,68,68,0.10)",  color: C.red },
  half_day:    { label: "Half Day",   bg: "rgba(168,85,247,0.10)", color: C.purple },
  week_off:    { label: "Week Off",   bg: "rgba(0,0,0,0.05)",      color: C.mute },
  holiday:     { label: "Holiday",    bg: "rgba(14,165,233,0.08)", color: C.blue },
  sick:        { label: "Sick Leave", bg: "rgba(14,165,233,0.10)", color: C.blue },
  casual:      { label: "Casual",     bg: "rgba(14,165,233,0.10)", color: C.blue },
  emergency:   { label: "Emergency",  bg: "rgba(14,165,233,0.10)", color: C.blue },
  earned:      { label: "Earned",     bg: "rgba(14,165,233,0.10)", color: C.blue },
  unpaid:      { label: "Unpaid",     bg: "rgba(239,68,68,0.08)",  color: C.red },
  short_leave: { label: "Short Leave",bg: "rgba(14,165,233,0.10)", color: C.blue },
  on_leave:    { label: "On Leave",   bg: "rgba(14,165,233,0.10)", color: C.blue },
};

function monthStart(d = new Date()) {
  const ist = istDate(d);                       // YYYY-MM-DD in IST
  return `${ist.slice(0, 7)}-01`;
}
function shiftMonth(monthISO, by) {
  const [y, m] = monthISO.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 10);
}
function monthLabel(monthISO) {
  const [y, m] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}
function monthEnd(monthISO) {
  const [y, m] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function hhmm(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
function hrs(mins) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m}m`;
}
function dayNum(workDate) { return workDate.slice(8, 10); }
function dayName(workDate) {
  return new Date(workDate + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
}

function Tile({ value, label, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.ink, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.mute, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.4px", fontWeight: 700 }}>{label}</div>
    </div>
  );
}

export default function AttendanceHistory({ subjectId, showName = false, onSelectDay }) {
  const [month, setMonth] = useState(() => monthStart());
  const [summary, setSummary] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true); setErr("");
    try {
      const [m, d] = await Promise.all([
        fetchAttendanceMonth(month, { subjectId }),
        fetchAttendanceDays({ subjectId, from: month, to: monthEnd(month) }),
      ]);
      setSummary(m[0] || null);
      setDays(d);
    } catch (e) {
      setErr(e?.message || "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }, [subjectId, month]);

  useEffect(() => { load(); }, [load]);

  const today = istDate();
  const isCurrentMonth = month.slice(0, 7) === today.slice(0, 7);
  // Don't show future dates in the current month — an empty row for a day that
  // hasn't happened reads as "absent".
  const visibleDays = useMemo(
    () => days.filter((d) => d.work_date <= today).sort((a, b) => b.work_date.localeCompare(a.work_date)),
    [days, today],
  );

  const leaveTotal = summary
    ? Number(summary.cl || 0) + Number(summary.el || 0) + Number(summary.sl || 0) +
      Number(summary.hd || 0) + Number(summary.shl || 0) + Number(summary.ul || 0)
    : 0;

  return (
    <div>
      {/* Month switcher */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"
          style={{ border: `1px solid ${C.line}`, background: C.card, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 15, color: C.ink }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{monthLabel(month)}</div>
          {showName && summary?.full_name && (
            <div style={{ fontSize: 12, color: C.mute }}>{summary.full_name}{summary.employee_code ? ` · ${summary.employee_code}` : ""}</div>
          )}
        </div>
        <button onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={isCurrentMonth} aria-label="Next month"
          style={{ border: `1px solid ${C.line}`, background: C.card, borderRadius: 8, padding: "6px 12px",
                   cursor: isCurrentMonth ? "not-allowed" : "pointer", opacity: isCurrentMonth ? 0.35 : 1, fontSize: 15, color: C.ink }}>›</button>
      </div>

      {/* A failed load must NOT fall through to the tiles below: zeros across the
          board plus "No attendance recorded" is indistinguishable from a real
          month of absences, and that is exactly how a statement timeout used to
          present itself. Show the failure and a way to retry, nothing else. */}
      {err && !loading ? (
        <div style={{ background: "rgba(239,68,68,0.06)", border: `1px solid rgba(239,68,68,0.2)`,
                      borderRadius: 12, padding: "22px 16px", textAlign: "center" }}>
          <div style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>Could not load this month.</div>
          <div style={{ color: C.mute, fontSize: 12, marginTop: 6 }}>{err}</div>
          <button onClick={load}
            style={{ marginTop: 14, border: `1px solid ${C.line}`, background: C.card, borderRadius: 8,
                     padding: "7px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.ink }}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div style={{ padding: 32, textAlign: "center", color: C.mute, fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
            <Tile value={summary?.days_worked ?? 0} label="Days" />
            <Tile value={summary?.on_time ?? 0} label="On time" color={C.green} />
            <Tile value={summary?.late ?? 0} label="Late" color={C.amber} />
            <Tile value={summary?.absent ?? 0} label="Absent" color={C.red} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
            <Tile value={leaveTotal} label="Leaves" color={C.blue} />
            <Tile value={hrs(summary?.worked_minutes)} label="Worked" />
            <Tile value={hrs(summary?.ot_minutes)} label="Overtime" color={C.purple} />
          </div>

          {Number(summary?.missing_checkout || 0) > 0 && (
            <div style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)", color: C.amber,
                          borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 14 }}>
              ⚠️ {summary.missing_checkout} day{summary.missing_checkout === 1 ? "" : "s"} with no check-out this month.
              Those days can't count worked hours — remember to punch out.
            </div>
          )}

          {/* Day list */}
          {visibleDays.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: C.mute, fontSize: 13,
                          background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12 }}>
              No attendance recorded this month.
            </div>
          ) : (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", background: C.card }}>
              {visibleDays.map((d, i) => {
                const badge = DAY_BADGE[d.day_status] || { label: d.day_status || "—", bg: "rgba(0,0,0,0.05)", color: C.mute };
                const clickable = typeof onSelectDay === "function";
                return (
                  <div
                    key={d.work_date}
                    onClick={clickable ? () => onSelectDay(d) : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      borderTop: i === 0 ? "none" : `1px solid ${C.line}`,
                      cursor: clickable ? "pointer" : "default",
                      background: d.work_date === today ? "rgba(232,162,74,0.06)" : "transparent",
                    }}
                  >
                    {/* Date */}
                    <div style={{ width: 38, textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{dayNum(d.work_date)}</div>
                      <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase", marginTop: 2 }}>{dayName(d.work_date)}</div>
                    </div>

                    {/* In / out */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>
                        {hhmm(d.in_at)} <span style={{ color: C.faint, fontWeight: 400 }}>→</span> {d.out_at ? hhmm(d.out_at) : <span style={{ color: C.amber }}>no check-out</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.mute, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.site_name || (d.is_holiday ? d.holiday_name : null) || (d.is_week_off ? "Week off" : "—")}
                        {d.worked_minutes ? ` · ${hrs(d.worked_minutes)}` : ""}
                        {d.ot_minutes ? ` · OT ${hrs(d.ot_minutes)}` : ""}
                        {d.any_unverified ? " · ⚠ location unconfirmed" : ""}
                      </div>
                    </div>

                    {/* Status */}
                    <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                                   background: badge.bg, color: badge.color, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
