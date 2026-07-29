import { useState, useEffect, useCallback } from "react";
import { fetchAttendance, fetchEmployees, updateAttendanceRecord, deleteAttendanceRecord } from "../../services/attendanceService.js";
import { useApp } from "../../context/AppContext.jsx";

const STATUS_OPTS   = ["present", "late", "absent", "half_day", "on_leave"];
const STATUS_COLORS = {
  present:  { bg: "rgba(34,197,94,0.1)",  color: "#16a34a" },
  late:     { bg: "rgba(245,158,11,0.1)", color: "#b45309" },
  absent:   { bg: "rgba(239,68,68,0.1)",  color: "#dc2626" },
  half_day: { bg: "rgba(168,85,247,0.1)", color: "#7c3aed" },
  on_leave: { bg: "rgba(14,165,233,0.1)", color: "#0369a1" },
};

function fmtDT(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function EditModal({ record, onSave, onClose }) {
  const [status, setStatus] = useState(record.status || "present");
  const [notes, setNotes]   = useState(record.admin_notes || "");
  const [busy, setBusy]     = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try { await updateAttendanceRecord(record.id, { status, admin_notes: notes }); onSave(); }
    catch { /* bubble up */ }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">Edit Record</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: "#5a5048" }}>
            <strong>{record.employees?.full_name}</strong> · {record.type === "check_in" ? "Check In" : "Check Out"} · {fmtDT(record.recorded_at)}
          </div>
          <div className="form-field">
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Admin Notes</label>
            <textarea className="form-input" rows={3} placeholder="Add notes or reason for correction…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleSave} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function SelfieModal({ url, name, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div style={{ background: "#1a1612", borderRadius: 16, padding: 8, maxWidth: 380, width: "90%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px 0", alignItems: "center" }}>
          <span style={{ color: "#f5f0e8", fontWeight: 600, fontSize: 14 }}>{name}</span>
          <button className="btn-ghost" onClick={onClose} style={{ color: "#8a7e72" }}>✕</button>
        </div>
        <img src={url} alt={name} style={{ width: "100%", borderRadius: 12, display: "block", marginTop: 8 }} />
      </div>
    </div>
  );
}

export default function AttendanceAdmin() {
  const { showToast } = useApp();
  const [records,   setRecords]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [empFilter, setEmpFilter] = useState("");
  const [dateFrom,  setDateFrom]  = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); });
  const [dateTo,    setDateTo]    = useState(() => new Date().toISOString().slice(0, 10));
  const [editModal, setEditModal] = useState(null);
  const [selfieModal, setSelfieModal] = useState(null);

  useEffect(() => { fetchEmployees().then(setEmployees).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAttendance({
        employeeId: empFilter || undefined,
        dateFrom:   dateFrom ? new Date(dateFrom + "T00:00:00").toISOString() : undefined,
        dateTo:     dateTo   ? new Date(dateTo   + "T23:59:59").toISOString() : undefined,
        limit: 500,
      });
      setRecords(data);
    } catch { showToast("Failed to load attendance records."); }
    finally  { setLoading(false); }
  }, [empFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (rec) => {
    if (!window.confirm(`Delete this ${rec.type.replace("_", " ")} record for ${rec.employees?.full_name}?`)) return;
    try {
      await deleteAttendanceRecord(rec.id);
      showToast("Record deleted.");
      load();
    } catch { showToast("Failed to delete record."); }
  };

  // Stats for current filter
  const totalIn  = records.filter((r) => r.type === "check_in").length;
  const totalOut = records.filter((r) => r.type === "check_out").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const uniqueDays = new Set(records.map((r) => r.recorded_at?.slice(0, 10))).size;

  // Export CSV
  const exportCSV = () => {
    const rows = [["Employee ID", "Name", "Department", "Type", "Date & Time", "Status", "Site", "Verified", "Accuracy (m)", "Latitude", "Longitude", "Address", "Selfie URL", "Admin Notes"]];
    for (const r of records) {
      rows.push([
        r.employees?.employee_code || "",
        r.employees?.full_name || "",
        r.employees?.department || "",
        r.type,
        r.recorded_at,
        r.status,
        r.site_name || "",
        r.location_verified === false ? "flagged" : "verified",
        r.accuracy != null ? Math.round(r.accuracy) : "",
        r.latitude ?? "",
        r.longitude ?? "",
        (r.address || "").replace(/,/g, ";"),
        r.selfie_url || "",
        (r.admin_notes || "").replace(/,/g, ";"),
      ]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `attendance_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  return (
    <div className="fade-in">
      <div className="page-title">Attendance Records</div>
      <div className="page-sub">View and manage all employee attendance. Only admin can edit records.</div>

      {/* Stats */}
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <div className="stat-card s1"><div className="stat-val">{records.length}</div><div className="stat-lbl">Total Records</div></div>
        <div className="stat-card s3"><div className="stat-val">{totalIn}</div><div className="stat-lbl">Check-ins</div></div>
        <div className="stat-card s2"><div className="stat-val">{totalOut}</div><div className="stat-lbl">Check-outs</div></div>
        <div className="stat-card s4"><div className="stat-val">{lateCount}</div><div className="stat-lbl">Late Arrivals</div></div>
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
        <div className="form-field">
          <label className="form-label">From</label>
          <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">To</label>
          <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn-outline" onClick={exportCSV} title="Export to CSV">⬇ Export CSV</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading records…</div>
        ) : records.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No attendance records for the selected filters.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e2d9", background: "#faf8f5" }}>
                {["Employee", "Type", "Date & Time", "Status", "Location", "Site", "Selfie", "Notes", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a7e72", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const sc = STATUS_COLORS[rec.status] || STATUS_COLORS.present;
                return (
                  <tr key={rec.id} style={{ borderBottom: "1px solid #f0ece5" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#faf8f5"}
                    onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1612" }}>{rec.employees?.full_name || "—"}</div>
                      <div style={{ fontSize: 11, color: "#e8a24a", fontFamily: "monospace", marginTop: 1 }}>{rec.employees?.employee_code}</div>
                      {rec.employees?.department && <div style={{ fontSize: 11, color: "#8a7e72" }}>{rec.employees.department}</div>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: rec.type === "check_in" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                        color: rec.type === "check_in" ? "#16a34a" : "#b45309",
                      }}>
                        {rec.type === "check_in" ? "✅ In" : "🏁 Out"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, color: "#1a1612", whiteSpace: "nowrap" }}>{fmtDT(rec.recorded_at)}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
                        {(rec.status || "present").replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", maxWidth: 200 }}>
                      {rec.latitude ? (
                        <a
                          href={`https://maps.google.com/?q=${rec.latitude},${rec.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, color: "#0a66c2", textDecoration: "none" }}
                          title={rec.address}
                        >
                          📍 {rec.address ? rec.address.slice(0, 40) + (rec.address.length > 40 ? "…" : "") : `${rec.latitude?.toFixed(4)}, ${rec.longitude?.toFixed(4)}`}
                        </a>
                      ) : <span style={{ color: "#b0a898", fontSize: 12 }}>No location</span>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {rec.site_name ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 12, color: rec.site_name === "Outside" ? "#dc2626" : "#1a1612", fontWeight: 600 }}>
                            {rec.site_name}
                          </span>
                          {rec.location_verified === false && (
                            <span style={{ padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#b45309" }} title="GPS could not confirm the site — review the selfie">
                              ⚠ Flagged
                            </span>
                          )}
                          {rec.accuracy != null && <span style={{ fontSize: 10, color: "#b0a898" }}>±{Math.round(rec.accuracy)}m</span>}
                        </div>
                      ) : <span style={{ color: "#b0a898", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {rec.selfie_url
                        ? <button className="btn-ghost" style={{ fontSize: 20, padding: "2px 6px" }} onClick={() => setSelfieModal({ url: rec.selfie_url, name: rec.employees?.full_name })}>🖼</button>
                        : <span style={{ color: "#b0a898", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px", maxWidth: 160, fontSize: 12, color: "#5a5048" }}>
                      {rec.admin_notes || <span style={{ color: "#b0a898" }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditModal(rec)}>Edit</button>
                        <button className="btn-ghost" style={{ fontSize: 12, color: "#dc2626" }} onClick={() => handleDelete(rec)}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editModal && (
        <EditModal
          record={editModal}
          onSave={() => { setEditModal(null); load(); showToast("Record updated."); }}
          onClose={() => setEditModal(null)}
        />
      )}

      {selfieModal && (
        <SelfieModal url={selfieModal.url} name={selfieModal.name} onClose={() => setSelfieModal(null)} />
      )}
    </div>
  );
}
