import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { fetchAttendanceDays } from "../../services/attendanceService.js";

// Replaces the HSIPL sheet's "Weekly Attendance" tab, which ran from a Start
// Date to an End Date. Here it's a grid: one row per person, one column per day.

const CODE = {
  present:     { t: "P",   bg: "rgba(34,197,94,.14)",   c: "#15803d" },
  late:        { t: "L",   bg: "rgba(245,158,11,.16)",  c: "#b45309" },
  absent:      { t: "A",   bg: "rgba(239,68,68,.14)",   c: "#dc2626" },
  week_off:    { t: "WO",  bg: "rgba(120,113,108,.10)", c: "#a8a29e" },
  holiday:     { t: "H",   bg: "rgba(14,165,233,.14)",  c: "#0369a1" },
  casual:      { t: "CL",  bg: "rgba(99,102,241,.14)",  c: "#4f46e5" },
  emergency:   { t: "EL",  bg: "rgba(168,85,247,.14)",  c: "#7c3aed" },
  sick:        { t: "SL",  bg: "rgba(236,72,153,.14)",  c: "#be185d" },
  half_day:    { t: "HD",  bg: "rgba(245,158,11,.14)",  c: "#b45309" },
  short_leave: { t: "SHL", bg: "rgba(20,184,166,.14)",  c: "#0f766e" },
  uninformed:  { t: "UL",  bg: "rgba(239,68,68,.20)",   c: "#b91c1c" },
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (m) => (m == null ? "" : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`);

/** Monday of the week containing `d` (the sheet's weeks ran Mon–Sun). */
function weekStart(d) {
  const x = new Date(d);
  const dow = x.getDay();               // 0 = Sun
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function WeeklyAttendance() {
  const { showToast } = useApp();
  const [start, setStart] = useState(() => iso(weekStart(new Date())));
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hideQuiet, setHideQuiet] = useState(false);

  const dates = useMemo(() => {
    const out = [];
    const s = new Date(start + "T00:00:00");
    for (let i = 0; i < days; i++) { const d = new Date(s); d.setDate(s.getDate() + i); out.push(iso(d)); }
    return out;
  }, [start, days]);

  const end = dates[dates.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchAttendanceDays({ from: start, to: end, limit: 20000 })); }
    catch { showToast("Could not load the weekly report."); setRows([]); }
    finally { setLoading(false); }
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  // group the flat day rows into one record per person
  const people = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.subject_id)) {
        m.set(r.subject_id, {
          subject_id: r.subject_id, subject_kind: r.subject_kind, full_name: r.full_name,
          employee_code: r.employee_code, department: r.department, byDate: {},
        });
      }
      m.get(r.subject_id).byDate[r.work_date] = r;
    }
    return [...m.values()].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [rows]);

  const shown = people.filter((p) => {
    const q = search.trim().toLowerCase();
    if (hideQuiet) {
      const active = dates.some((d) => ["present", "late"].includes(p.byDate[d]?.day_status));
      if (!active) return false;
    }
    return !q || (p.full_name || "").toLowerCase().includes(q)
              || (p.employee_code || "").toLowerCase().includes(q)
              || (p.department || "").toLowerCase().includes(q);
  });

  const rowTotals = (p) => {
    let worked = 0, late = 0, ot = 0, mins = 0, absent = 0;
    for (const d of dates) {
      const r = p.byDate[d]; if (!r) continue;
      if (r.day_status === "present" || r.day_status === "late") worked++;
      if (r.day_status === "late") late++;
      if (r.day_status === "absent") absent++;
      ot += Number(r.ot_minutes || 0);
      mins += Number(r.worked_minutes || 0);
    }
    return { worked, late, ot, mins, absent };
  };

  const exportCSV = () => {
    const head = ["Employee ID", "Name", "Department", ...dates, "Days Worked", "Late", "Absent", "Hours", "OT Hours"];
    const body = shown.map((p) => {
      const t = rowTotals(p);
      return [p.employee_code || "", p.full_name, p.department || "",
        ...dates.map((d) => {
          const r = p.byDate[d];
          if (!r) return "";
          const code = CODE[r.day_status]?.t || r.day_status;
          return r.worked_minutes ? `${code} ${hhmm(r.worked_minutes)}` : code;
        }),
        t.worked, t.late, t.absent, (t.mins / 60).toFixed(2), (t.ot / 60).toFixed(2),
      ].map((c) => String(c ?? "").replace(/,/g, ";"));
    });
    const csv = [head, ...body].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `weekly_attendance_${start}_to_${end}.csv`;
    a.click();
  };

  const shift = (n) => {
    const d = new Date(start + "T00:00:00");
    d.setDate(d.getDate() + n * days);
    setStart(iso(d));
  };

  const fmtHead = (d) => {
    const dt = new Date(d + "T00:00:00");
    return { dow: dt.toLocaleDateString("en-IN", { weekday: "short" }), day: dt.getDate(),
             mon: dt.toLocaleDateString("en-IN", { month: "short" }) };
  };

  const TH = { padding: "8px 6px", fontSize: 10, fontWeight: 700, color: "#8a7e72",
    borderBottom: "1px solid #e8e2d9", textTransform: "uppercase", letterSpacing: ".4px", whiteSpace: "nowrap" };

  const totalsAll = shown.reduce((a, p) => { const t = rowTotals(p);
    return { worked: a.worked + t.worked, late: a.late + t.late, absent: a.absent + t.absent, ot: a.ot + t.ot }; },
    { worked: 0, late: 0, absent: 0, ot: 0 });

  return (
    <div className="fade-in">
      <div className="page-title">Weekly Attendance</div>
      <div className="page-sub">
        One row per person, one column per day — the replacement for the old Weekly Attendance tab.
        Hover any cell for the in/out times.
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 18 }}>
        <div className="stat-card s1"><div className="stat-val">{shown.length}</div><div className="stat-lbl">People</div></div>
        <div className="stat-card s3"><div className="stat-val">{totalsAll.worked}</div><div className="stat-lbl">Days Worked</div></div>
        <div className="stat-card s4"><div className="stat-val">{totalsAll.late}</div><div className="stat-lbl">Late</div></div>
        <div className="stat-card s2"><div className="stat-val">{totalsAll.absent}</div><div className="stat-lbl">Absent</div></div>
        <div className="stat-card s2"><div className="stat-val">{(totalsAll.ot / 60).toFixed(0)}</div><div className="stat-lbl">OT Hours</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <button className="btn-outline" onClick={() => shift(-1)} title="Previous period">←</button>
          <div className="form-field" style={{ minWidth: 150 }}>
            <label className="form-label">Week starting</label>
            <input className="form-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <button className="btn-outline" onClick={() => shift(1)} title="Next period">→</button>
        </div>
        <div className="form-field" style={{ minWidth: 120 }}>
          <label className="form-label">Span</label>
          <select className="form-input" value={days} onChange={(e) => setDays(+e.target.value)}>
            <option value={7}>1 week</option>
            <option value={14}>2 weeks</option>
            <option value={30}>30 days</option>
          </select>
        </div>
        <div className="form-field" style={{ minWidth: 190, flex: 1 }}>
          <label className="form-label">Search</label>
          <input className="form-input" placeholder="Name, ID or department…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#5a5048", paddingBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={hideQuiet} onChange={(e) => setHideQuiet(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "#e8a24a" }} />
          Only people who worked
        </label>
        <button className="btn-outline" onClick={() => setStart(iso(weekStart(new Date())))}>This week</button>
        <button className="btn-outline" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, fontSize: 11, color: "#5a5048" }}>
        {Object.entries(CODE).map(([k, v]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ padding: "1px 6px", borderRadius: 5, background: v.bg, color: v.c, fontWeight: 800, fontSize: 10 }}>{v.t}</span>
            {k.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading {start} → {end}…</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No attendance between {start} and {end}.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 200 + dates.length * 62 }}>
            <thead>
              <tr style={{ background: "#faf8f5" }}>
                <th style={{ ...TH, textAlign: "left", position: "sticky", left: 0, background: "#faf8f5", minWidth: 190 }}>Employee</th>
                {dates.map((d) => {
                  const h = fmtHead(d);
                  const wknd = [0, 6].includes(new Date(d + "T00:00:00").getDay());
                  return (
                    <th key={d} style={{ ...TH, textAlign: "center", background: wknd ? "#f5f2ec" : "#faf8f5" }}>
                      <div>{h.dow}</div>
                      <div style={{ fontSize: 11, color: "#5a5048" }}>{h.day} {h.mon}</div>
                    </th>
                  );
                })}
                {["Worked", "Late", "Hours", "OT"].map((h) => (
                  <th key={h} style={{ ...TH, textAlign: "right", background: "#f5f2ec" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const t = rowTotals(p);
                return (
                  <tr key={p.subject_id} style={{ borderBottom: "1px solid #f0ece5" }}>
                    <td style={{ padding: "7px 10px", position: "sticky", left: 0, background: "#fff", borderRight: "1px solid #f0ece5" }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: "#1a1612" }}>{p.full_name}</div>
                      <div style={{ fontSize: 10, color: "#8a7e72" }}>
                        {p.employee_code
                          ? <span style={{ fontFamily: "monospace", color: "#e8a24a" }}>{p.employee_code}</span>
                          : <span title="Historic record, not yet linked to a hub account">roster</span>}
                        {p.department ? ` · ${p.department}` : ""}
                      </div>
                    </td>
                    {dates.map((d) => {
                      const r = p.byDate[d];
                      const meta = r ? (CODE[r.day_status] || CODE.present) : null;
                      const tip = r
                        ? [r.day_status.replace(/_/g, " "),
                           r.in_at ? `in ${new Date(r.in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : null,
                           r.out_at ? `out ${new Date(r.out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : (r.in_at ? "no check-out" : null),
                           r.site_name, r.holiday_name,
                           r.ot_minutes > 0 ? `OT ${hhmm(r.ot_minutes)}` : null].filter(Boolean).join(" · ")
                        : "no record";
                      return (
                        <td key={d} style={{ padding: "6px 4px", textAlign: "center" }} title={tip}>
                          {r ? (
                            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1,
                              padding: "3px 7px", borderRadius: 6, background: meta.bg, minWidth: 40 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: meta.c }}>{meta.t}</span>
                              {r.worked_minutes != null && (
                                <span style={{ fontSize: 9, color: "#5a5048" }}>{hhmm(r.worked_minutes)}</span>
                              )}
                              {r.in_at && !r.out_at && <span style={{ fontSize: 9, color: "#dc2626" }}>no out</span>}
                            </div>
                          ) : <span style={{ color: "#d8d2c8", fontSize: 11 }}>·</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 12, fontWeight: 700 }}>{t.worked}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 12, color: t.late ? "#b45309" : "#b0a898" }}>{t.late}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 12 }}>{(t.mins / 60).toFixed(1)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 12, color: t.ot ? "#16a34a" : "#b0a898", fontWeight: t.ot ? 700 : 400 }}>
                      {(t.ot / 60).toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
