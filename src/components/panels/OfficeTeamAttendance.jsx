import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../context/AppContext.jsx";
import {
  fetchOfficeTeam, fetchAssignableSubjects, setOfficeTeam,
  fetchOfficeTeamMonth, fetchOfficeTeamDays, fetchOfficeTeamRemarks,
  monthOptions, monthLabel, monthEnd,
} from "../../services/officeTeamService.js";
import { fetchAttendanceSettings } from "../../services/attendanceService.js";
import { buildReport } from "../../services/officeTeamReport.js";
import { buildWorkbook, download } from "../../services/officeTeamExcel.js";

// The EA's Office Team report. One month sheet per person, in the same layout
// as the printed HSIPL month sheet, downloadable as a real .xlsx.
//
// Distinct from Monthly Report (which covers everyone, including the ~60
// imported roster names with no hub login) — this is the fifteen office staff
// who punch on the portal, which is the list the EA actually circulates.

const CELL = { padding: "7px 8px", fontSize: 12, borderBottom: "1px solid #f0ece5", textAlign: "center" };
const TH   = { padding: "9px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: ".4px", color: "#8a7e72", whiteSpace: "nowrap", borderBottom: "1px solid #e8e2d9" };

const STATUS_STYLE = {
  "On Time": { background: "rgba(34,197,94,0.14)", color: "#15803d" },
  "Late":    { background: "rgba(245,158,11,0.16)", color: "#b45309" },
  "Absent":  { background: "rgba(239,68,68,0.14)",  color: "#c00000" },
  "Leave":   { background: "rgba(99,102,241,0.12)", color: "#4f46e5" },
  "Holiday": { background: "rgba(14,165,233,0.14)", color: "#0369a1" },
};

// ─── One person's month sheet ────────────────────────────────────────────────

function MonthSheet({ report, onClose, onDownload, busy }) {
  const h = report.header;
  const tiles = [
    ["Total Working Days", h.totalWorkingDays], ["On Time", h.onTime], ["Late", h.late],
    ["CL", h.cl], ["EL", h.el], ["SL", h.sl], ["HD", h.hd],
    ["UL", h.ul], ["SHL", h.shl], ["Sundays", h.weekOffs],
  ];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 1080, width: "94vw" }}>
        <div className="modal-hdr">
          <div>
            <h3 className="modal-title">{h.name}</h3>
            <div style={{ fontSize: 12, color: "#8a7e72" }}>
              {monthLabel(report.month)}{h.employeeCode ? ` · ${h.employeeCode}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn-gold" onClick={onDownload} disabled={busy}>
              {busy ? "Building…" : "⬇ Excel"}
            </button>
            <button className="btn-ghost" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0, maxHeight: "74vh", overflow: "auto" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px 18px", background: "#faf8f5",
            borderBottom: "1px solid #e8e2d9", position: "sticky", top: 0, zIndex: 1 }}>
            {tiles.map(([label, v]) => (
              <div key={label} style={{ minWidth: 78, padding: "6px 10px", background: "#fff",
                border: "1px solid #e8e2d9", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: v > 0 ? "#1a1612" : "#c9c2b7" }}>{v}</div>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".4px", color: "#8a7e72" }}>{label}</div>
              </div>
            ))}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#faf8f5" }}>
                {["Date", "IN Time", "OUT Time", "Total Hours", "Over Time", "Status", "Leaves", "Weekend", "Remarks"]
                  .map((c) => <th key={c} style={TH}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.date} style={{ background: r.isWeekOff ? "#faf8f5" : "" }}>
                  <td style={{ ...CELL, whiteSpace: "nowrap", fontWeight: 600 }}>{r.dateLabel}</td>
                  <td style={CELL}>{r.inTime || "—"}</td>
                  <td style={{ ...CELL, color: r.missingCheckout ? "#c00000" : "inherit" }}>
                    {r.outTime || (r.missingCheckout ? "missing" : "—")}
                  </td>
                  <td style={CELL}>{r.totalHours != null ? r.totalHours.toFixed(2) : "—"}</td>
                  <td style={{ ...CELL, color: r.overTime > 0 ? "#15803d" : "#b0a898", fontWeight: r.overTime > 0 ? 700 : 400 }}>
                    {r.overTime != null ? r.overTime.toFixed(2) : "—"}
                  </td>
                  <td style={CELL}>
                    {r.status && (
                      <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                        whiteSpace: "nowrap", ...(STATUS_STYLE[r.status] || {}) }}>{r.status}</span>
                    )}
                  </td>
                  <td style={CELL}>
                    {r.leaves && (
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: "rgba(239,68,68,0.12)", color: "#c00000" }}>{r.leaves}</span>
                    )}
                  </td>
                  <td style={{ ...CELL, fontWeight: 700, color: "#78716c" }}>{r.weekend}</td>
                  <td style={{ ...CELL, textAlign: "left", color: "#5a5048", fontSize: 11 }}>{r.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ borderTop: "1px solid #e8e2d9", padding: "12px 18px", background: "#faf8f5",
          fontSize: 12, color: "#5a5048" }}>
          <strong>Total Hours Worked:</strong> {report.totals.hours.toFixed(2)} hrs
          {"  ·  "}<strong>Total Overtime:</strong> {report.totals.overtime.toFixed(2)} hrs
          {h.missingCheckouts > 0 && (
            <span style={{ color: "#c00000" }}>
              {"  ·  "}{h.missingCheckouts} day{h.missingCheckouts > 1 ? "s" : ""} with no check-out
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add / remove people ─────────────────────────────────────────────────────

function ManageTeam({ team, onClose, onChanged }) {
  const { showToast } = useApp();
  const [all, setAll] = useState(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => { fetchAssignableSubjects().then(setAll).catch(() => setAll([])); }, []);

  const inTeam = useMemo(() => new Set(team.map((t) => t.subject_id)), [team]);

  const toggle = async (row, on) => {
    setSaving(row.subject_id);
    try {
      await setOfficeTeam(row.employee_id, on);
      await onChanged();
    } catch (e) {
      showToast("Could not update the team. You may not have permission.");
    } finally { setSaving(""); }
  };

  const filtered = (all || []).filter((r) => {
    const s = q.trim().toLowerCase();
    return !s || (r.full_name || "").toLowerCase().includes(s)
              || (r.employee_code || "").toLowerCase().includes(s)
              || (r.department || "").toLowerCase().includes(s);
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }}>
        <div className="modal-hdr">
          <div>
            <h3 className="modal-title">Office team</h3>
            <div style={{ fontSize: 12, color: "#8a7e72" }}>
              {team.length} selected · who the report covers
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #e8e2d9" }}>
          <input className="form-input" placeholder="Search name, ID or department…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <p style={{ fontSize: 11, color: "#8a7e72", margin: "8px 0 0" }}>
            Only hub employees appear here. Imported roster names have no login, so they
            can never punch on the portal and cannot be on this report.
          </p>
        </div>
        <div className="modal-body" style={{ padding: 0, maxHeight: "56vh", overflow: "auto" }}>
          {!all ? (
            <div style={{ padding: 30, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
          ) : filtered.map((r) => {
            const on = inTeam.has(r.subject_id);
            return (
              <label key={r.subject_id} style={{ display: "flex", gap: 10, alignItems: "center",
                padding: "9px 18px", borderBottom: "1px solid #f0ece5", cursor: "pointer",
                background: on ? "rgba(232,162,74,0.06)" : "" }}>
                <input type="checkbox" checked={on} disabled={saving === r.subject_id}
                  onChange={(e) => toggle(r, e.target.checked)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1612" }}>{r.full_name}</div>
                  <div style={{ fontSize: 10, color: "#8a7e72" }}>
                    {r.employee_code
                      ? <span style={{ fontFamily: "monospace", color: "#e8a24a" }}>{r.employee_code}</span>
                      : "no employee code"}
                    {r.department ? ` · ${r.department}` : ""}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function OfficeTeamAttendance() {
  const { showToast } = useApp();
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [team, setTeam] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [people, cfg] = await Promise.all([fetchOfficeTeam(), fetchAttendanceSettings()]);
      setTeam(people);
      const ids = people.map((p) => p.subject_id);
      const from = month;
      const to = monthEnd(month);
      const [summaries, days, remarks] = await Promise.all([
        fetchOfficeTeamMonth(month, ids),
        fetchOfficeTeamDays({ subjectIds: ids, from, to }),
        fetchOfficeTeamRemarks({ from, to }),
      ]);
      const daysBy = new Map();
      for (const d of days) {
        if (!daysBy.has(d.subject_id)) daysBy.set(d.subject_id, []);
        daysBy.get(d.subject_id).push(d);
      }
      const sumBy = new Map(summaries.map((s) => [s.subject_id, s]));
      const remBy = new Map();
      for (const r of remarks) {
        const k = r.employee_id || r.person_ref;
        if (!remBy.has(k)) remBy.set(k, []);
        remBy.get(k).push(r);
      }
      setReports(people.map((subject) => buildReport({
        subject,
        summary: sumBy.get(subject.subject_id) || null,
        days: daysBy.get(subject.subject_id) || [],
        remarks: remBy.get(subject.subject_id) || [],
        settings: cfg, month,
      })));
    } catch (e) {
      showToast("Could not load the office team report.");
      setReports([]);
    } finally { setLoading(false); }
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const shown = reports.filter((r) => {
    const s = search.trim().toLowerCase();
    return !s || r.header.name.toLowerCase().includes(s)
              || (r.header.employeeCode || "").toLowerCase().includes(s);
  });

  // Exports exactly the reports already on screen, so the file can never
  // disagree with what the EA is looking at.
  const exportExcel = async (reports, label) => {
    if (!reports.length) return;
    setBusy(label);
    try {
      download(await buildWorkbook({ reports }));
    } catch (e) {
      showToast("Could not build the Excel file.");
    } finally { setBusy(""); }
  };

  const totals = shown.reduce((a, r) => ({
    worked: a.worked + r.header.totalWorkingDays,
    late: a.late + r.header.late,
    absent: a.absent + r.header.absent,
    ot: a.ot + r.totals.overtime,
    missing: a.missing + r.header.missingCheckouts,
  }), { worked: 0, late: 0, absent: 0, ot: 0, missing: 0 });

  return (
    <div className="fade-in">
      <div className="page-title">Office Team Attendance</div>
      <div className="page-sub">
        A month sheet per person in the same layout as the printed one, for the {team.length} office
        staff on the punch portal. Click a row to read it; download one person or the whole team as Excel.
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 20 }}>
        <div className="stat-card s1"><div className="stat-val">{shown.length}</div><div className="stat-lbl">People</div></div>
        <div className="stat-card s3"><div className="stat-val">{totals.worked}</div><div className="stat-lbl">Days Worked</div></div>
        <div className="stat-card s4"><div className="stat-val">{totals.late}</div><div className="stat-lbl">Late Arrivals</div></div>
        <div className="stat-card s2"><div className="stat-val">{totals.ot.toFixed(0)}</div><div className="stat-lbl">OT Hours</div></div>
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
          <input className="form-input" placeholder="Name or employee ID…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-outline" onClick={() => setManage(true)}>⚙ Manage team</button>
        <button className="btn-gold" disabled={busy === "all" || !shown.length}
          onClick={() => exportExcel(shown, "all")}>
          {busy === "all" ? "Building…" : `⬇ Excel — all ${shown.length}`}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading {monthLabel(month)}…</div>
        ) : !team.length ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>
            No one is on the office team yet. Use <strong>Manage team</strong> to add people.
          </div>
        ) : !shown.length ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No one matches that search.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
            <thead>
              <tr style={{ background: "#faf8f5" }}>
                <th style={{ ...TH, textAlign: "left" }}>Employee</th>
                {["Working Days", "On Time", "Late", "Absent", "CL", "EL", "SL", "HD", "SHL", "UL", "Hours", "OT", ""]
                  .map((c, i) => <th key={i} style={{ ...TH, textAlign: c ? "right" : "center" }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const h = r.header;
                const NUM = { padding: "9px 8px", textAlign: "right", fontSize: 12, whiteSpace: "nowrap" };
                return (
                  <tr key={r.subject.subject_id} style={{ borderBottom: "1px solid #f0ece5", cursor: "pointer" }}
                    onClick={() => setOpen(r)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#faf8f5")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "9px 10px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1612" }}>{h.name}</div>
                      <div style={{ fontSize: 10, color: "#8a7e72" }}>
                        {h.employeeCode
                          ? <span style={{ fontFamily: "monospace", color: "#e8a24a" }}>{h.employeeCode}</span>
                          : "no employee code"}
                        {r.subject.department ? ` · ${r.subject.department}` : ""}
                      </div>
                    </td>
                    <td style={{ ...NUM, fontWeight: 700 }}>{h.totalWorkingDays}</td>
                    <td style={{ ...NUM, color: "#15803d" }}>{h.onTime}</td>
                    <td style={{ ...NUM, color: h.late > 0 ? "#b45309" : "#c9c2b7", fontWeight: h.late > 0 ? 700 : 400 }}>{h.late}</td>
                    <td style={{ ...NUM, color: h.absent > 0 ? "#c00000" : "#c9c2b7", fontWeight: h.absent > 0 ? 700 : 400 }}>{h.absent}</td>
                    {[h.cl, h.el, h.sl, h.hd, h.shl, h.ul].map((v, i) => (
                      <td key={i} style={{ ...NUM, color: v > 0 ? "#1a1612" : "#d8d2c8" }}>{v}</td>
                    ))}
                    <td style={NUM}>{r.totals.hours.toFixed(1)}</td>
                    <td style={{ ...NUM, color: r.totals.overtime > 0 ? "#15803d" : "#c9c2b7",
                      fontWeight: r.totals.overtime > 0 ? 700 : 400 }}>{r.totals.overtime.toFixed(1)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "center" }}>
                      <button className="btn-ghost" style={{ fontSize: 11 }}
                        disabled={busy === r.subject.subject_id}
                        onClick={(e) => { e.stopPropagation(); exportExcel([r], r.subject.subject_id); }}>
                        {busy === r.subject.subject_id ? "…" : "⬇ Excel"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <MonthSheet report={open} onClose={() => setOpen(null)} busy={busy === open.subject.subject_id}
          onDownload={() => exportExcel([open], open.subject.subject_id)} />
      )}
      {manage && (
        <ManageTeam team={team} onClose={() => setManage(false)}
          onChanged={async () => { await load(); }} />
      )}
    </div>
  );
}
