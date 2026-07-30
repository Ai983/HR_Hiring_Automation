import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { fetchAttendanceMonth, fetchAttendanceDays, fetchAttendanceSubjects } from "../../services/attendanceService.js";

// Replaces the HSIPL sheet's "Overtime Sheet" (per-person month totals + a row
// per date) and "Monthly Attendance" tabs.

const STATUS = {
  present:     { label: "Present",   bg: "rgba(34,197,94,0.12)",  color: "#16a34a" },
  late:        { label: "Late",      bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  absent:      { label: "Absent",    bg: "rgba(239,68,68,0.12)",  color: "#dc2626" },
  week_off:    { label: "Week Off",  bg: "rgba(120,113,108,0.12)",color: "#78716c" },
  holiday:     { label: "Holiday",   bg: "rgba(14,165,233,0.12)", color: "#0369a1" },
  casual:      { label: "CL",        bg: "rgba(99,102,241,0.12)", color: "#4f46e5" },
  emergency:   { label: "EL",        bg: "rgba(168,85,247,0.12)", color: "#7c3aed" },
  sick:        { label: "SL",        bg: "rgba(236,72,153,0.12)", color: "#be185d" },
  half_day:    { label: "HD",        bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  short_leave: { label: "SHL",       bg: "rgba(20,184,166,0.12)", color: "#0f766e" },
  uninformed:  { label: "UL",        bg: "rgba(239,68,68,0.12)",  color: "#dc2626" },
};

const hhmm = (min) => (min == null ? "—" : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);
const monthLabel = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const dayLabel = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
const timeIST = (ts) => (ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—");

function monthOptions(count = 18) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

// ─── Per-person day-by-day drawer ────────────────────────────────────────────

function DayDetail({ row, month, onClose }) {
  const [days, setDays] = useState(null);

  useEffect(() => {
    const from = month;
    const to = new Date(new Date(month + "T00:00:00").getFullYear(), new Date(month + "T00:00:00").getMonth() + 1, 0);
    const toIso = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`;
    fetchAttendanceDays({ subjectId: row.subject_id, from, to })
      .then((d) => setDays([...d].sort((a, b) => a.work_date.localeCompare(b.work_date))))
      .catch(() => setDays([]));
  }, [row.subject_id, month]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 860 }}>
        <div className="modal-hdr">
          <div>
            <h3 className="modal-title">{row.full_name}</h3>
            <div style={{ fontSize: 12, color: "#8a7e72" }}>
              {monthLabel(month)}
              {row.employee_code ? ` · ${row.employee_code}` : ""}
              {row.subject_kind === "roster" ? " · not linked to a hub account" : ""}
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 0, maxHeight: "68vh", overflow: "auto" }}>
          {!days ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#faf8f5", position: "sticky", top: 0 }}>
                  {["Date", "IN", "OUT", "Hours", "OT", "Status", "Site", "Photo"].map((h) => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: ".5px", color: "#8a7e72", borderBottom: "1px solid #e8e2d9" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const st = STATUS[d.day_status] || STATUS.present;
                  return (
                    <tr key={d.work_date} style={{ borderBottom: "1px solid #f0ece5",
                      background: d.day_status === "absent" ? "rgba(239,68,68,0.04)" : "" }}>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{dayLabel(d.work_date)}</td>
                      <td style={{ padding: "8px 12px" }}>{timeIST(d.in_at)}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {d.out_at ? timeIST(d.out_at) : (d.in_at ? <span style={{ color: "#dc2626" }}>missing</span> : "—")}
                      </td>
                      <td style={{ padding: "8px 12px" }}>{hhmm(d.worked_minutes)}</td>
                      <td style={{ padding: "8px 12px", color: d.ot_minutes > 0 ? "#16a34a" : "#b0a898", fontWeight: d.ot_minutes > 0 ? 700 : 400 }}>
                        {d.ot_minutes > 0 ? hhmm(d.ot_minutes) : "—"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color, whiteSpace: "nowrap" }}>
                          {d.holiday_name || st.label}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#5a5048" }}>{d.site_name || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {d.photo ? <a href={d.photo} target="_blank" rel="noreferrer" style={{ color: "#0a66c2" }}>view</a> : "—"}
                      </td>
                    </tr>
                  );
                })}
                {days.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#8a7e72" }}>No records for this month.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function MonthlyAttendance() {
  const { showToast } = useApp();
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");     // "" | employee | roster
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchAttendanceMonth(month)); }
    catch (e) { showToast("Could not load the monthly report."); setRows([]); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (kind && r.subject_kind !== kind) return false;
    return !q || (r.full_name || "").toLowerCase().includes(q)
              || (r.employee_code || "").toLowerCase().includes(q)
              || (r.department || "").toLowerCase().includes(q);
  });

  const totals = filtered.reduce((a, r) => ({
    people: a.people + 1,
    worked: a.worked + Number(r.days_worked || 0),
    late: a.late + Number(r.late || 0),
    absent: a.absent + Number(r.absent || 0),
    ot: a.ot + Number(r.ot_minutes || 0),
    missing: a.missing + Number(r.missing_checkout || 0),
  }), { people: 0, worked: 0, late: 0, absent: 0, ot: 0, missing: 0 });

  const exportCSV = () => {
    const head = ["Employee ID", "Name", "Type", "Department", "Month", "Working Days", "Days Worked",
      "On Time", "Late", "Absent", "Week Offs", "Holidays", "CL", "EL", "SL", "HD", "SHL", "UL",
      "Worked Hours", "OT Hours", "Missing Checkouts"];
    const body = filtered.map((r) => [
      r.employee_code || "", r.full_name, r.subject_kind, r.department || "", monthLabel(r.month),
      r.working_days, r.days_worked, r.on_time, r.late, r.absent, r.week_offs, r.holidays,
      r.cl, r.el, r.sl, r.hd, r.shl, r.ul,
      (r.worked_minutes / 60).toFixed(2), (r.ot_minutes / 60).toFixed(2), r.missing_checkout,
    ].map((c) => String(c ?? "").replace(/,/g, ";")));
    const csv = [head, ...body].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `monthly_attendance_${month.slice(0, 7)}.csv`;
    a.click();
  };

  const NUM = { padding: "9px 10px", textAlign: "right", fontSize: 12, whiteSpace: "nowrap" };
  const TH = { padding: "10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: ".4px", color: "#8a7e72", whiteSpace: "nowrap", borderBottom: "1px solid #e8e2d9" };

  return (
    <div className="fade-in">
      <div className="page-title">Monthly Attendance</div>
      <div className="page-sub">
        Working days, overtime and leave per person — the replacement for the old Overtime Sheet.
        Click any row for the day-by-day breakdown.
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 20 }}>
        <div className="stat-card s1"><div className="stat-val">{totals.people}</div><div className="stat-lbl">People</div></div>
        <div className="stat-card s3"><div className="stat-val">{totals.worked}</div><div className="stat-lbl">Days Worked</div></div>
        <div className="stat-card s4"><div className="stat-val">{totals.late}</div><div className="stat-lbl">Late Arrivals</div></div>
        <div className="stat-card s2"><div className="stat-val">{(totals.ot / 60).toFixed(0)}</div><div className="stat-lbl">OT Hours</div></div>
        <div className="stat-card s4"><div className="stat-val">{totals.missing}</div><div className="stat-lbl">Missing Check-outs</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-field" style={{ minWidth: 180 }}>
          <label className="form-label">Month</label>
          <select className="form-input" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ minWidth: 200, flex: 1 }}>
          <label className="form-label">Search</label>
          <input className="form-input" placeholder="Name, ID or department…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="form-field" style={{ minWidth: 170 }}>
          <label className="form-label">Record type</label>
          <select className="form-input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Everyone</option>
            <option value="employee">Hub employees</option>
            <option value="roster">Roster (unlinked)</option>
          </select>
        </div>
        <button className="btn-outline" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading {monthLabel(month)}…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No attendance recorded for {monthLabel(month)}.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
            <thead>
              <tr style={{ background: "#faf8f5" }}>
                <th style={{ ...TH, textAlign: "left" }}>Employee</th>
                {["Work Days", "Worked", "On Time", "Late", "Absent", "W/Off", "Hol", "CL", "EL", "SL", "HD", "SHL", "UL", "Hours", "OT"].map((h) => (
                  <th key={h} style={{ ...TH, textAlign: "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.subject_id} style={{ borderBottom: "1px solid #f0ece5", cursor: "pointer" }}
                  onClick={() => setDetail(r)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#faf8f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "9px 10px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1612" }}>{r.full_name}</div>
                    <div style={{ fontSize: 10, color: "#8a7e72" }}>
                      {r.employee_code
                        ? <span style={{ fontFamily: "monospace", color: "#e8a24a" }}>{r.employee_code}</span>
                        : <span title="Historic record not yet linked to a hub account">roster</span>}
                      {r.department ? ` · ${r.department}` : ""}
                    </div>
                  </td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{r.working_days}</td>
                  <td style={NUM}>{r.days_worked}</td>
                  <td style={{ ...NUM, color: "#16a34a" }}>{r.on_time}</td>
                  <td style={{ ...NUM, color: r.late > 0 ? "#b45309" : "#b0a898", fontWeight: r.late > 0 ? 700 : 400 }}>{r.late}</td>
                  <td style={{ ...NUM, color: r.absent > 0 ? "#dc2626" : "#b0a898", fontWeight: r.absent > 0 ? 700 : 400 }}>{r.absent}</td>
                  <td style={{ ...NUM, color: "#b0a898" }}>{r.week_offs}</td>
                  <td style={{ ...NUM, color: "#b0a898" }}>{r.holidays}</td>
                  {[r.cl, r.el, r.sl, r.hd, r.shl, r.ul].map((v, i) => (
                    <td key={i} style={{ ...NUM, color: v > 0 ? "#1a1612" : "#d8d2c8" }}>{v}</td>
                  ))}
                  <td style={NUM}>{(r.worked_minutes / 60).toFixed(1)}</td>
                  <td style={{ ...NUM, color: r.ot_minutes > 0 ? "#16a34a" : "#b0a898", fontWeight: r.ot_minutes > 0 ? 700 : 400 }}>
                    {(r.ot_minutes / 60).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && <DayDetail row={detail} month={month} onClose={() => setDetail(null)} />}
    </div>
  );
}
