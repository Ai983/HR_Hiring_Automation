import { useState, useEffect, useCallback } from "react";
import { fetchTodayBoard, istDate } from "../../services/attendanceService.js";
import AttendanceHistory from "../attendance/AttendanceHistory.jsx";
import { useApp } from "../../context/AppContext.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// The daily view the Attendance Records panel could not give: who is in, who is
// late, who is still out — and who has not punched at all. That last list is the
// point. A punch log can only show people who punched, so anyone missing was
// invisible; here they get a row.
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors hr.is_hr_admin() exactly — keep the two in step. RLS is what actually
// enforces this; the check here exists only so a non-admin gets told why the
// board is empty instead of a screen of zeros that looks like a broken feature.
// Every role has the `attendance` module, so ordinary employees do reach this panel.
const HR_ADMIN_ROLES = new Set(["admin", "hr", "founder", "management", "ai", "mis"]);

const STATE_META = {
  in:       { label: "Checked in",  bg: "rgba(34,197,94,0.10)",  color: "#16a34a" },
  done:     { label: "Completed",   bg: "rgba(14,165,233,0.10)", color: "#0369a1" },
  not_in:   { label: "Not punched", bg: "rgba(239,68,68,0.10)",  color: "#dc2626" },
  on_leave: { label: "On leave",    bg: "rgba(168,85,247,0.10)", color: "#7c3aed" },
};

function hhmm(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
function hrs(mins) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m}m`;
}

function PersonDrawer({ person, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620, width: "94%" }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{person.full_name}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <AttendanceHistory subjectId={person.subject_id} showName={false} />
        </div>
      </div>
    </div>
  );
}

function PersonRow({ r, onOpen }) {
  const meta = STATE_META[r.state] || STATE_META.not_in;
  return (
    <div
      onClick={() => onOpen(r)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: "1px solid #f0ece5", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#faf8f5")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1612" }}>
          {r.full_name}
          {r.late && <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#b45309" }}>Late</span>}
          {r.flagged && <span style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#b45309" }} title="GPS could not confirm the site">⚠ GPS</span>}
        </div>
        <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 2 }}>
          {r.employee_code || "—"}{r.site_name ? ` · ${r.site_name}` : ""}
          {r.state === "on_leave" ? ` · ${(r.leave_type || r.day_status || "leave").replace("_", " ")}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 12, color: "#5a5048", whiteSpace: "nowrap" }}>
        {r.state === "not_in" ? <span style={{ color: "#b0a898" }}>no punch</span> : <>{hhmm(r.in_at)} → {r.out_at ? hhmm(r.out_at) : <span style={{ color: "#b45309" }}>—</span>}</>}
        {r.worked_minutes ? <div style={{ fontSize: 11, color: "#b0a898" }}>{hrs(r.worked_minutes)}{r.ot_minutes ? ` · OT ${hrs(r.ot_minutes)}` : ""}</div> : null}
      </div>
      <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: meta.bg, color: meta.color, whiteSpace: "nowrap" }}>
        {meta.label}
      </span>
    </div>
  );
}

function Section({ title, hint, rows, onOpen }) {
  if (!rows.length) return null;
  return (
    <div className="card" style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", background: "#faf8f5", borderBottom: "1px solid #e8e2d9" }}>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a7e72" }}>
          {title} <span style={{ color: "#b0a898" }}>({rows.length})</span>
        </div>
        {hint && <div style={{ fontSize: 11.5, color: "#b0a898", marginTop: 3 }}>{hint}</div>}
      </div>
      {rows.map((r) => <PersonRow key={r.subject_id} r={r} onOpen={onOpen} />)}
    </div>
  );
}

export default function TodayAttendance() {
  const { showToast, ctx } = useApp();
  const isHrAdmin = HR_ADMIN_ROLES.has(String(ctx?.role || "").toLowerCase());
  const [date, setDate] = useState(() => istDate());
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState(null);

  const load = useCallback(async () => {
    if (!isHrAdmin) { setLoading(false); return; }
    setLoading(true);
    try { setBoard(await fetchTodayBoard(date)); }
    catch { showToast("Could not load today's attendance."); }
    finally { setLoading(false); }
  }, [date, isHrAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Refresh while HR watches the morning come in.
  useEffect(() => {
    if (!isHrAdmin || date !== istDate()) return;   // only poll when viewing today
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [date, load, isHrAdmin]);

  if (!isHrAdmin) {
    return (
      <div className="fade-in">
        <div className="page-title">Today</div>
        <div className="card" style={{ padding: 40, textAlign: "center", maxWidth: 560, margin: "24px auto" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18, color: "#1a1612", marginBottom: 8 }}>
            This board is for HR and admins
          </div>
          <p style={{ fontSize: 13, color: "#8a7e72", lineHeight: 1.6, marginBottom: 0 }}>
            You're signed in as <strong>{ctx?.name}</strong> ({ctx?.role || "employee"}), so the
            database only returns your own attendance — the team board would show all zeros.
            <br /><br />
            To see your own record, open the attendance portal and tap <strong>My Attendance</strong>.
            Ask an admin if you need the team view.
          </p>
        </div>
      </div>
    );
  }

  const c = board?.counts;
  const rows = board?.rows || [];
  const notIn   = rows.filter((r) => r.state === "not_in");
  const stillIn = rows.filter((r) => r.state === "in");
  const done    = rows.filter((r) => r.state === "done");
  const onLeave = rows.filter((r) => r.state === "on_leave");

  return (
    <div className="fade-in">
      <div className="page-title">Today</div>
      <div className="page-sub">
        Live attendance board. Click anyone to see their full record.
        {board && <> Tracking <strong>{board.enrolled}</strong> people using the portal (of {board.rosterActive} active employees).</>}
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 18 }}>
        <div className="stat-card s1"><div className="stat-val">{c?.in ?? "—"}</div><div className="stat-lbl">In Now</div></div>
        <div className="stat-card s3"><div className="stat-val">{c?.done ?? "—"}</div><div className="stat-lbl">Completed</div></div>
        <div className="stat-card s4"><div className="stat-val">{c?.late ?? "—"}</div><div className="stat-lbl">Late</div></div>
        <div className="stat-card s2"><div className="stat-val">{c?.not_in ?? "—"}</div><div className="stat-lbl">Not Punched</div></div>
        <div className="stat-card s1"><div className="stat-val">{c?.on_leave ?? "—"}</div><div className="stat-lbl">On Leave</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="form-field">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} max={istDate()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn-outline" onClick={load}>↻ Refresh</button>
        {date !== istDate() && <button className="btn-ghost" onClick={() => setDate(istDate())}>Back to today</button>}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No attendance activity for this date.</div>
      ) : (
        <>
          <Section title="Not punched in" hint="Nobody has a check-in for this date — the list to chase." rows={notIn} onOpen={setPerson} />
          <Section title="Still checked in" hint="No check-out yet. Chase these at end of day." rows={stillIn} onOpen={setPerson} />
          <Section title="Completed" rows={done} onOpen={setPerson} />
          <Section title="On leave" rows={onLeave} onOpen={setPerson} />
        </>
      )}

      {person && <PersonDrawer person={person} onClose={() => setPerson(null)} />}
    </div>
  );
}
