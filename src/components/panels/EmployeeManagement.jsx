import { useState, useEffect } from "react";
import { fetchEmployees, createEmployee, updateEmployee, toggleEmployeeActive, resetEmployeePin } from "../../services/attendanceService.js";
import { useApp } from "../../context/AppContext.jsx";

const DEPARTMENTS = ["Design", "Civil", "MEP", "Site", "Project Management", "Finance", "HR", "Admin", "Procurement", "IT"];
const DESIGNATIONS = ["Interior Designer", "Civil Engineer", "Site Engineer", "Project Manager", "MEP Engineer", "HR Manager", "Accountant", "Site Supervisor", "Draftsman", "Admin Executive"];

const EMPTY_FORM = { employee_code: "", full_name: "", email: "", phone: "", department: "", designation: "", pin: "" };

function EmployeeModal({ emp, onSave, onClose }) {
  const [form, setForm]   = useState(emp ? { ...emp, pin: "" } : EMPTY_FORM);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.employee_code.trim()) { setErr("Employee ID is required."); return; }
    if (!form.full_name.trim())     { setErr("Full name is required."); return; }
    if (!emp && !form.pin.trim())   { setErr("PIN is required for new employees."); return; }
    if (form.pin && (form.pin.length < 4 || form.pin.length > 6 || !/^\d+$/.test(form.pin))) {
      setErr("PIN must be 4–6 digits."); return;
    }
    setBusy(true); setErr("");
    try {
      if (emp) {
        const updates = { ...form };
        if (!updates.pin) delete updates.pin;
        await updateEmployee(emp.id, updates);
      } else {
        await createEmployee(form);
      }
      onSave();
    } catch (e) {
      setErr(e.message?.includes("unique") ? "Employee ID already exists." : "Failed to save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{emp ? "Edit Employee" : "Add Employee"}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Employee ID *</label>
              <input className="form-input" placeholder="EMP001" value={form.employee_code} onChange={set("employee_code")} disabled={!!emp} />
            </div>
            <div className="form-field">
              <label className="form-label">PIN ({emp ? "leave blank to keep" : "4–6 digits"}) {!emp && "*"}</label>
              <input className="form-input" type="password" inputMode="numeric" maxLength={6} placeholder="••••" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="Rahul Sharma" value={form.full_name} onChange={set("full_name")} />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="rahul@hagerstone.com" value={form.email} onChange={set("email")} />
            </div>
            <div className="form-field">
              <label className="form-label">Phone</label>
              <input className="form-input" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Department</label>
              <select className="form-input" value={form.department} onChange={set("department")}>
                <option value="">Select…</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Designation</label>
              <select className="form-input" value={form.designation} onChange={set("designation")}>
                <option value="">Select…</option>
                {DESIGNATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {err && <div style={{ background: "#fff1f0", border: "1px solid #fecaca", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>{err}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : emp ? "Save Changes" : "Add Employee"}
          </button>
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
  const [modal, setModal]         = useState(null); // null | { mode: 'add'|'edit', emp }
  const [pinModal, setPinModal]   = useState(null); // emp to reset PIN
  const [newPin, setNewPin]       = useState("");
  const [pinBusy, setPinBusy]     = useState(false);

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
    return !q || e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q) || (e.department || "").toLowerCase().includes(q);
  });

  const handleToggle = async (emp) => {
    try {
      await toggleEmployeeActive(emp.id, emp.is_active);
      showToast(`${emp.full_name} ${emp.is_active ? "deactivated" : "activated"}.`);
      load();
    } catch { showToast("Failed to update status."); }
  };

  const handleResetPin = async () => {
    if (!newPin || newPin.length < 4 || !/^\d+$/.test(newPin)) { showToast("PIN must be 4–6 digits."); return; }
    setPinBusy(true);
    try {
      await resetEmployeePin(pinModal.id, newPin);
      showToast(`PIN reset for ${pinModal.full_name}.`);
      setPinModal(null); setNewPin("");
    } catch { showToast("Failed to reset PIN."); }
    finally { setPinBusy(false); }
  };

  const active   = employees.filter((e) => e.is_active).length;
  const inactive = employees.length - active;

  return (
    <div className="fade-in">
      <div className="page-title">Employees</div>
      <div className="page-sub">Manage employee records and access credentials</div>

      {/* Stats */}
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 20 }}>
        <div className="stat-card s1"><div className="stat-val">{employees.length}</div><div className="stat-lbl">Total Employees</div></div>
        <div className="stat-card s3"><div className="stat-val">{active}</div><div className="stat-lbl">Active</div></div>
        <div className="stat-card s4"><div className="stat-val">{inactive}</div><div className="stat-lbl">Inactive</div></div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <input
          className="form-input"
          style={{ flex: 1, maxWidth: 320 }}
          placeholder="Search by name, ID or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-gold" onClick={() => setModal({ mode: "add", emp: null })}>+ Add Employee</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>
            {employees.length === 0 ? "No employees yet. Add your first employee to get started." : "No results match your search."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e2d9", background: "#faf8f5" }}>
                {["ID", "Name", "Department", "Designation", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a7e72" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: "1px solid #f0ece5", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#faf8f5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#e8a24a", background: "rgba(232,162,74,0.1)", padding: "2px 8px", borderRadius: 6 }}>{emp.employee_code}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1612" }}>{emp.full_name}</div>
                    {emp.email && <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 1 }}>{emp.email}</div>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#5a5048" }}>{emp.department || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#5a5048" }}>{emp.designation || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: emp.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      color: emp.is_active ? "#16a34a" : "#dc2626"
                    }}>{emp.is_active ? "Active" : "Inactive"}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setModal({ mode: "edit", emp })}>Edit</button>
                      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setPinModal(emp); setNewPin(""); }}>Reset PIN</button>
                      <button className="btn-ghost" style={{ fontSize: 12, color: emp.is_active ? "#dc2626" : "#16a34a" }} onClick={() => handleToggle(emp)}>
                        {emp.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <EmployeeModal
          emp={modal.emp}
          onSave={() => { setModal(null); load(); showToast(modal.emp ? "Employee updated." : "Employee added."); }}
          onClose={() => setModal(null)}
        />
      )}

      {/* Reset PIN modal */}
      {pinModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setPinModal(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-hdr">
              <h3 className="modal-title">Reset PIN — {pinModal.full_name}</h3>
              <button className="btn-ghost" onClick={() => setPinModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label className="form-label">New PIN (4–6 digits)</label>
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter new PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setPinModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={handleResetPin} disabled={pinBusy}>{pinBusy ? "Saving…" : "Reset PIN"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
