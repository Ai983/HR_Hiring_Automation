import { useState, useEffect } from "react";
import { fetchEmployees, setEmployeePin, setTrackLocation } from "../../services/attendanceService.js";
import { useApp } from "../../context/AppContext.jsx";

// HR settings modal — identity is read-only (synced from the company master);
// only PIN and location-tracking are HireFlow-managed (hr.employee_profile).
function HrSettingsModal({ emp, onSaved, onClose }) {
  const [pin, setPin]     = useState("");
  const [track, setTrack] = useState(!!emp.track_location);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");

  const handleSave = async () => {
    if (pin && (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))) {
      setErr("PIN must be 4–6 digits."); return;
    }
    setBusy(true); setErr("");
    try {
      if (track !== !!emp.track_location) await setTrackLocation(emp.id, track);
      if (pin) await setEmployeePin(emp.id, pin);
      onSaved();
    } catch (e) {
      setErr(e.message || "Failed to save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const ro = (label, val) => (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <div style={{ fontSize: 14, color: "#1a1612", padding: "8px 0" }}>{val || "—"}</div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">HR Settings — {emp.full_name}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: "#8a7e72", marginBottom: 6 }}>
            Identity is synced from the company employee master (read-only). HireFlow manages PIN &amp; location tracking.
          </div>
          <div className="form-grid">
            {ro("Employee ID", emp.employee_code)}
            {ro("Status", emp.is_active ? "Active" : "Inactive")}
          </div>
          <div className="form-grid">
            {ro("Department", emp.department)}
            {ro("Designation", emp.designation)}
          </div>
          <div className="form-grid">
            {ro("Email", emp.email)}
            {ro("Phone", emp.phone)}
          </div>

          <div style={{ height: 1, background: "#e8e2d9", margin: "8px 0" }} />

          <div className="form-field">
            <label className="form-label">
              {emp.pin ? "Change PIN (leave blank to keep)" : "Set PIN (4–6 digits)"}
            </label>
            <input
              className="form-input" type="password" inputMode="numeric" maxLength={6}
              placeholder={emp.pin ? "••••" : "Enter PIN"}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
            <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 4 }}>
              {emp.pin ? "A PIN is set — the employee can punch attendance." : "No PIN yet — required before this employee can punch attendance."}
            </div>
          </div>

          <div className="form-field">
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#e8a24a" }} />
              <span style={{ fontSize: 13 }}>
                <strong>Enable location tracking</strong>
                <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 2 }}>
                  Turn on for field/site staff — geofence-checked on punch + live GPS pings. Office staff stay off.
                </div>
              </span>
            </label>
          </div>

          {err && <div style={{ background: "#fff1f0", border: "1px solid #fecaca", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>{err}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleSave} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeManagement() {
  const { showToast } = useApp();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [modal, setModal]         = useState(null); // emp being managed

  const load = async () => {
    setLoading(true);
    try {
      setEmployees(await fetchEmployees());
    } catch { showToast("Failed to load employees."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return !q || (e.full_name || "").toLowerCase().includes(q) || (e.employee_code || "").toLowerCase().includes(q) || (e.department || "").toLowerCase().includes(q);
  });

  const active  = employees.filter((e) => e.is_active).length;
  const tracked = employees.filter((e) => e.track_location).length;
  const pinned  = employees.filter((e) => e.pin).length;

  return (
    <div className="fade-in">
      <div className="page-title">Employees</div>
      <div className="page-sub">Synced from the company employee master. HireFlow manages attendance PIN &amp; location tracking.</div>

      {/* Stats */}
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <div className="stat-card s1"><div className="stat-val">{employees.length}</div><div className="stat-lbl">Total Employees</div></div>
        <div className="stat-card s3"><div className="stat-val">{active}</div><div className="stat-lbl">Active</div></div>
        <div className="stat-card s2"><div className="stat-val">{pinned}</div><div className="stat-lbl">PIN Set</div></div>
        <div className="stat-card s4"><div className="stat-val">{tracked}</div><div className="stat-lbl">Location Tracked</div></div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <input className="form-input" style={{ flex: 1, maxWidth: 320 }}
          placeholder="Search by name, ID or department…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>
            {employees.length === 0 ? "No employees found in the company master." : "No results match your search."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e2d9", background: "#faf8f5" }}>
                {["ID", "Name", "Department", "Designation", "PIN", "Tracking", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a7e72" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid #f0ece5" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#faf8f5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#e8a24a", background: "rgba(232,162,74,0.1)", padding: "2px 8px", borderRadius: 6 }}>{emp.employee_code || "—"}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1612" }}>{emp.full_name}</div>
                    {emp.email && <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 1 }}>{emp.email}</div>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#5a5048" }}>{emp.department || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#5a5048" }}>{emp.designation || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: emp.pin ? "#16a34a" : "#b0a898" }}>
                      {emp.pin ? "● Set" : "○ Not set"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {emp.track_location
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", background: "rgba(14,165,233,0.12)", padding: "2px 8px", borderRadius: 20 }}>📍 On</span>
                      : <span style={{ fontSize: 12, color: "#b0a898" }}>Off</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setModal(emp)}>HR Settings</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <HrSettingsModal
          emp={modal}
          onSaved={() => { setModal(null); load(); showToast("Employee HR settings updated."); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
