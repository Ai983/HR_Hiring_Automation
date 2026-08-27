import { useState, useEffect, useCallback } from "react";
import { fetchEmployees } from "../../services/attendanceService.js";
import { fetchLeaveRequests, updateLeaveStatus, deleteLeaveRequest } from "../../services/leaveService.js";
import { LEAVE_TYPES, APPROVERS, LEAVE_STATUSES, STATUS_META } from "../../leaveConfig.js";
import { notifyLeaveDecision } from "../../services/whatsappService.js";
import { useApp } from "../../context/AppContext.jsx";

const typeMeta      = (v) => LEAVE_TYPES.find((t) => t.value === v);
const typeLabel     = (v) => { const m = typeMeta(v); return m ? `${m.short} — ${m.label}` : v; };
const typeShort     = (v) => typeMeta(v)?.short || v;
const approverLabel = (v) => APPROVERS.find((a) => a.value === v)?.label || v || "—";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRange(s, e) {
  if (s === e) return fmtDate(s);
  return `${fmtDate(s)} → ${fmtDate(e)}`;
}

// Approve / Reject modal — captures admin notes; the reviewer is the signed-in
// user, not a typed name. Saving also WhatsApps the employee the outcome.
function ReviewModal({ record, action, onSave, onClose }) {
  const { ctx } = useApp();
  const [notes, setNotes] = useState(record.admin_notes || "");
  const [busy, setBusy]   = useState(false);
  const status = action === "approve" ? "approved" : "rejected";

  // Whoever is logged in owns the decision — this used to be a free-text box, so
  // the audit trail recorded whatever the admin felt like typing.
  const reviewedBy = ctx?.name || ctx?.email || "HR";

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateLeaveStatus(record.id, { status, admin_notes: notes, reviewed_by: reviewedBy });
    } catch {
      setBusy(false);
      onSave({ ok: false });
      return;
    }
    // The decision is committed. Telling the employee is a best-effort follow-up:
    // sendWhatsApp never throws, but a failure here must not read as a failed
    // approval — it only changes which toast the panel shows.
    const res = await notifyLeaveDecision(record.employees, record, {
      status, admin_notes: notes, reviewed_by: reviewedBy,
    }).catch(() => ({ success: false }));
    setBusy(false);
    onSave({ ok: true, status, notified: !!res?.success });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{action === "approve" ? "Approve" : "Reject"} Leave</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: "#5a5048", lineHeight: 1.6 }}>
            <strong>{record.employees?.full_name}</strong> · {typeLabel(record.leave_type)}<br />
            {fmtRange(record.start_date, record.end_date)} · {record.total_days} day(s)
            {Number(record.unpaid_days) > 0 && (
              <span style={{ color: "#dc2626", fontWeight: 700 }}> · {record.unpaid_days} unpaid</span>
            )}
            {record.reason && <div style={{ marginTop: 6, fontStyle: "italic", color: "#8a7e72" }}>“{record.reason}”</div>}
            <div style={{ marginTop: 8, fontSize: 12, color: record.employees?.phone ? "#16a34a" : "#b45309" }}>
              {record.employees?.phone
                ? `📲 WhatsApp will be sent to ${record.employees.phone}`
                : "⚠️ No phone on file — this employee won't be notified automatically."}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Reviewed by</label>
            <div className="form-input" style={{ background: "#faf8f5", color: "#5a5048", cursor: "default" }}>{reviewedBy}</div>
          </div>
          <div className="form-field">
            <label className="form-label">Notes {action === "reject" ? "(reason for rejection)" : "(optional)"}</label>
            <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : action === "approve" ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveRequests() {
  const { showToast, ctx } = useApp();
  // Only the HR-admin role decides leaves. Every other user keeps the list, the
  // stats and the CSV export, but not the Approve / Reject / Change / Delete controls.
  const canDecide = !!ctx?.is_hr_admin;
  const [records,   setRecords]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [empFilter, setEmpFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter]     = useState("");
  const [review,    setReview]    = useState(null); // { record, action }

  useEffect(() => { fetchEmployees().then(setEmployees).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await fetchLeaveRequests({
        employeeId: empFilter || undefined,
        status:     statusFilter || undefined,
      }));
    } catch { showToast("Failed to load leave requests."); }
    finally  { setLoading(false); }
  }, [empFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (rec) => {
    if (!window.confirm(`Delete this leave request for ${rec.employees?.full_name}?`)) return;
    try { await deleteLeaveRequest(rec.id); showToast("Request deleted."); load(); }
    catch { showToast("Failed to delete request."); }
  };

  const shown = typeFilter ? records.filter((r) => r.leave_type === typeFilter) : records;

  // Stats
  const pending  = records.filter((r) => r.status === "pending").length;
  const approved = records.filter((r) => r.status === "approved").length;
  const unpaidTotal = records
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + Number(r.unpaid_days || 0), 0);

  const exportCSV = () => {
    const rows = [["Employee ID", "Name", "Department", "Request To", "Type", "Start", "End", "Total Days", "Paid Days", "Unpaid Days", "Status", "Reason", "Reviewed By", "Notes"]];
    for (const r of records) {
      rows.push([
        r.employees?.employee_code || "", r.employees?.full_name || "", r.employees?.department || "",
        approverLabel(r.request_to), typeLabel(r.leave_type),
        r.start_date, r.end_date, r.total_days, r.paid_days, r.unpaid_days, r.status,
        (r.reason || "").replace(/,/g, ";"), r.reviewed_by || "", (r.admin_notes || "").replace(/,/g, ";"),
      ]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `leave_requests.csv`;
    a.click();
  };

  return (
    <div className="fade-in">
      <div className="page-title">Leave Requests</div>
      <div className="page-sub">Review and approve employee leave. 2 paid days per month — extra days are unpaid (salary deducted).</div>

      {/* Stats */}
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <div className="stat-card s1"><div className="stat-val">{records.length}</div><div className="stat-lbl">Total Requests</div></div>
        <div className="stat-card s4"><div className="stat-val">{pending}</div><div className="stat-lbl">Pending</div></div>
        <div className="stat-card s3"><div className="stat-val">{approved}</div><div className="stat-lbl">Approved</div></div>
        <div className="stat-card s2"><div className="stat-val">{unpaidTotal}</div><div className="stat-lbl">Unpaid Days (approved)</div></div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-field" style={{ minWidth: 200, flex: 1 }}>
          <label className="form-label">Employee</label>
          <select className="form-input" value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
            <option value="">All Employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ minWidth: 150 }}>
          <label className="form-label">Leave type</label>
          <select className="form-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.short} — {t.label}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ minWidth: 160 }}>
          <label className="form-label">Status</label>
          <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {LEAVE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
        <button className="btn-outline" onClick={exportCSV} title="Export to CSV">⬇ Export CSV</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading requests…</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No leave requests for the selected filters.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e2d9", background: "#faf8f5" }}>
                {["Employee", "To", "Type", "Dates", "Days", "Reason", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a7e72", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((rec) => {
                const sm = STATUS_META[rec.status] || STATUS_META.pending;
                return (
                  <tr key={rec.id} style={{ borderBottom: "1px solid #f0ece5" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#faf8f5"}
                    onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1612" }}>{rec.employees?.full_name || "—"}</div>
                      <div style={{ fontSize: 11, color: "#e8a24a", fontFamily: "monospace", marginTop: 1 }}>{rec.employees?.employee_code}</div>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "#5a5048", whiteSpace: "nowrap" }}>{approverLabel(rec.request_to)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "#1a1612", whiteSpace: "nowrap" }}
                        title={typeLabel(rec.leave_type)}>{typeShort(rec.leave_type)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "#1a1612", whiteSpace: "nowrap" }}>{fmtRange(rec.start_date, rec.end_date)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 700, color: "#1a1612" }}>{rec.total_days}</span>
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        <span style={{ color: "#16a34a" }}>{rec.paid_days} paid</span>
                        {Number(rec.unpaid_days) > 0 && <span style={{ color: "#dc2626" }}> · {rec.unpaid_days} unpaid</span>}
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", maxWidth: 200, fontSize: 12, color: "#5a5048" }}>
                      {rec.reason || <span style={{ color: "#b0a898" }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>
                        {sm.label}
                      </span>
                      {rec.reviewed_by && <div style={{ fontSize: 10, color: "#b0a898", marginTop: 3 }}>by {rec.reviewed_by}</div>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {!canDecide ? (
                        <span style={{ fontSize: 11, color: "#b0a898" }}>View only</span>
                      ) : (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {rec.status === "pending" && (
                            <>
                              <button className="btn-ghost" style={{ fontSize: 12, color: "#16a34a" }} onClick={() => setReview({ record: rec, action: "approve" })}>Approve</button>
                              <button className="btn-ghost" style={{ fontSize: 12, color: "#dc2626" }} onClick={() => setReview({ record: rec, action: "reject" })}>Reject</button>
                            </>
                          )}
                          {rec.status !== "pending" && (
                            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setReview({ record: rec, action: rec.status === "approved" ? "reject" : "approve" })}>Change</button>
                          )}
                          <button className="btn-ghost" style={{ fontSize: 12, color: "#dc2626" }} onClick={() => handleDelete(rec)}>Del</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {review && (
        <ReviewModal
          record={review.record}
          action={review.action}
          onSave={(res) => {
            if (!res?.ok) { showToast("Failed to update the request."); return; }
            setReview(null); load();
            const word = res.status === "approved" ? "approved" : "rejected";
            showToast(res.notified
              ? `Leave ${word} — employee notified on WhatsApp.`
              : `Leave ${word}, but the WhatsApp could not be sent. Please inform the employee.`);
          }}
          onClose={() => setReview(null)}
        />
      )}
    </div>
  );
}
