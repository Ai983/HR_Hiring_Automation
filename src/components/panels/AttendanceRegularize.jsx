import { useState, useEffect, useCallback } from "react";
import { fetchAttendanceSubjects, fetchRegularizations, regularizeAttendance } from "../../services/attendanceService.js";
import { isAttendanceRegularizer } from "../../leaveConfig.js";
import { useApp } from "../../context/AppContext.jsx";

// Statuses the EA can set a day to. Mirrors the CHECK on
// hr.attendance_regularization.new_status — all values roll up in attendance_month.
const STATUS_OPTIONS = [
  { value: "present",     label: "Present (worked)" },
  { value: "late",        label: "Late" },
  { value: "half_day",    label: "Half Day" },
  { value: "short_leave", label: "Short Leave" },
  { value: "casual",      label: "Casual Leave" },
  { value: "emergency",   label: "Emergency Leave" },
  { value: "sick",        label: "Sick Leave" },
  { value: "uninformed",  label: "Uninformed (UL)" },
  { value: "absent",      label: "Absent" },
  { value: "week_off",    label: "Week Off" },
  { value: "holiday",     label: "Holiday" },
];

function fmtDate(v) {
  if (!v) return "—";
  return new Date(String(v) + (String(v).length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTs(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AttendanceRegularize() {
  const { ctx, showToast } = useApp();
  const canRegularize = isAttendanceRegularizer(ctx?.email);
  const myId = ctx?.employee_id || null;

  const [subjects, setSubjects] = useState([]);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ subjectId: "", workDate: "", status: "present", reason: "", inAt: "", outAt: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [s, r] = await Promise.all([
      fetchAttendanceSubjects().catch(() => []),
      fetchRegularizations().catch(() => []),   // table may not exist until the migration is applied
    ]);
    setSubjects(s);
    setRows(r);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const nameFor = (id) => subjects.find((x) => x.subject_id === id)?.full_name || id;
  const selectable = subjects.filter((s) => s.subject_id !== myId);   // can't pick yourself

  const submit = async () => {
    if (!form.subjectId)      return showToast("Pick an employee.", false);
    if (!form.workDate)       return showToast("Pick a date.", false);
    if (!form.reason.trim())  return showToast("A reason is required — it goes on the record.", false);
    if (myId && form.subjectId === myId) return showToast("You cannot regularize your own record.", false);
    setSaving(true);
    try {
      await regularizeAttendance({
        subjectId: form.subjectId,
        workDate:  form.workDate,
        status:    form.status,
        reason:    form.reason.trim(),
        inAt:  form.inAt  ? new Date(form.inAt).toISOString()  : null,
        outAt: form.outAt ? new Date(form.outAt).toISOString() : null,
      });
      showToast("Attendance correction applied.");
      setForm((f) => ({ ...f, reason: "", inAt: "", outAt: "" }));
      await load();
    } catch (e) {
      showToast(e.message || "Could not apply the correction.", false);
    }
    setSaving(false);
  };

  return (
    <div className="fade-in">
      <div className="page-title">Attendance Corrections</div>
      <div className="page-sub">
        EA-only. Every change is recorded with who, when and why. You cannot change your own record.
      </div>

      {canRegularize ? (
        <div className="card" style={{ padding: "18px 22px", marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label">Employee</label>
              <select className="form-input" value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}>
                <option value="">Select…</option>
                {selectable.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.workDate} onChange={(e) => setForm((f) => ({ ...f, workDate: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Corrected status</label>
              <select className="form-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="form-label">Check-in (optional)</label>
              <input type="datetime-local" className="form-input" value={form.inAt} onChange={(e) => setForm((f) => ({ ...f, inAt: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Check-out (optional)</label>
              <input type="datetime-local" className="form-input" value={form.outAt} onChange={(e) => setForm((f) => ({ ...f, outAt: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="form-label">Reason (required)</label>
            <textarea className="form-input" rows={2} value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Approved off-site work on this date, per <approver name>, <date>" />
          </div>
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <button className="btn-gold" onClick={submit} disabled={saving}>{saving ? "Applying…" : "Apply correction"}</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#8a7e72" }}>
          You can view corrections here, but only the EA can apply them.
        </div>
      )}

      <div className="card" style={{ padding: "6px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30 }}><span className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#8a7e72", fontSize: 13 }}>No corrections recorded yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#8a7e72" }}>
                <th style={{ padding: "8px 16px" }}>Date</th>
                <th style={{ padding: "8px 16px" }}>Employee</th>
                <th style={{ padding: "8px 16px" }}>New status</th>
                <th style={{ padding: "8px 16px" }}>Reason</th>
                <th style={{ padding: "8px 16px" }}>By</th>
                <th style={{ padding: "8px 16px" }}>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #f0ece5" }}>
                  <td style={{ padding: "8px 16px" }}>{fmtDate(r.work_date)}</td>
                  <td style={{ padding: "8px 16px" }}>{nameFor(r.subject_id)}</td>
                  <td style={{ padding: "8px 16px", fontWeight: 700 }}>{r.new_status}</td>
                  <td style={{ padding: "8px 16px", color: "#5a5048", maxWidth: 340 }}>{r.reason}</td>
                  <td style={{ padding: "8px 16px", color: "#8a7e72" }}>{r.regularized_by_email || "—"}</td>
                  <td style={{ padding: "8px 16px", color: "#8a7e72" }}>{fmtTs(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
