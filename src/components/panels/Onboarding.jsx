import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { fetchJoinings, createJoining, updateJoining } from "../../services/joiningService.js";
import { fetchOfferForApplicant } from "../../services/offerService.js";
import { updateApplicantStage } from "../../services/applicantService.js";
import { initDocuments } from "../../services/documentService.js";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const MODAL = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };

const TRACKS = [
  { key: "it_request_sent",     label: "IT Setup Requested" },
  { key: "finance_setup_done",  label: "Finance / Payroll Setup" },
  { key: "kra_set",             label: "KRA Set with Manager" },
  { key: "attendance_enrolled", label: "Attendance Enrolled" },
  { key: "induction_done",      label: "Induction Done" },
];

const STATUS_ORDER = ["pre_joining", "doc_pending", "doc_submitted", "day1_ready", "joined", "induction_done", "probation_active", "confirmed"];
const STATUS_COLOR = { pre_joining: "#6366f1", doc_pending: "#f97316", doc_submitted: "#0ea5e9", day1_ready: "#22c55e", joined: "#10b981", induction_done: "#14b8a6", probation_active: "#8b5cf6", confirmed: "#22c55e" };

export default function Onboarding() {
  const { applicants, refreshApplicants, showToast } = useApp();
  const [joinings, setJoinings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ joining_date: "", joining_location: "", joining_type: "hq", reporting_manager_email: "", employee_id: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setJoinings(await fetchJoinings());
    setLoading(false);
  }

  const hiredApps = applicants.filter((a) => a.stage === "hired" || a.stage === "onboarding");

  async function startOnboarding() {
    if (!form.joining_date) return showToast("Select joining date.", false);
    setSaving(true);
    try {
      const offer = await fetchOfferForApplicant(createModal.id);
      const probationEnd = new Date(form.joining_date);
      probationEnd.setMonth(probationEnd.getMonth() + (offer?.probation_months || 6));
      const joining = await createJoining({
        applicant_id: createModal.id,
        offer_id: offer?.id || null,
        ...form,
        status: "pre_joining",
        probation_end_date: probationEnd.toISOString().split("T")[0],
      });
      await initDocuments(joining.id);
      await updateApplicantStage(createModal.id, "onboarding");
      await refreshApplicants();
      await load();
      setCreateModal(null);
      showToast("Onboarding started. Document checklist initialized.");
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  }

  async function toggleTrack(joiningId, key, current) {
    await updateJoining(joiningId, { [key]: !current });
    await load();
  }

  async function updateStatus(joiningId, status) {
    await updateJoining(joiningId, { status });
    await load();
    showToast(`Status updated to ${status}.`);
  }

  return (
    <div className="fade-in">
      <div className="page-title">Onboarding</div>
      <div className="page-sub">Track every new joiner across all 5 onboarding tracks until confirmed.</div>

      {hiredApps.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#5a5048", marginBottom: 12 }}>Start Onboarding ({hiredApps.length})</div>
          {hiredApps.map((app) => (
            <div key={app.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0ece5" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{app.name}</div>
                <div style={{ fontSize: 11, color: "#8a7e72" }}>Stage: {app.stage}</div>
              </div>
              <button className="btn-gold" style={{ fontSize: 12, padding: "5px 14px" }} onClick={() => { setCreateModal(app); setForm({ joining_date: "", joining_location: "", joining_type: "hq", reporting_manager_email: "", employee_id: "" }); }}>
                Start Onboarding
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : (
        joinings.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "#8a7e72", padding: 40 }}>No active onboardings.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {joinings.map((j) => (
              <div key={j.id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{j.applicants?.full_name}</div>
                    <div style={{ fontSize: 12, color: "#8a7e72" }}>{j.applicants?.jobs?.title} · Joining: {j.joining_date} · {j.joining_location || "—"}</div>
                    {j.probation_end_date && <div style={{ fontSize: 11, color: "#8a7e72" }}>Probation ends: {j.probation_end_date}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[j.status], background: `${STATUS_COLOR[j.status]}18`, padding: "2px 8px", borderRadius: 20 }}>
                      {j.status?.replace(/_/g, " ")}
                    </span>
                    <select className="form-input" style={{ fontSize: 11, padding: "3px 6px" }} value={j.status} onChange={(e) => updateStatus(j.id, e.target.value)}>
                      {STATUS_ORDER.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {TRACKS.map((t) => (
                    <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: j[t.key] ? "rgba(34,197,94,0.08)" : "#faf8f5", border: `1px solid ${j[t.key] ? "#22c55e44" : "#e5e7eb"}`, cursor: "pointer" }}
                      onClick={() => toggleTrack(j.id, t.key, j[t.key])}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${j[t.key] ? "#22c55e" : "#d0c8be"}`, background: j[t.key] ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", flexShrink: 0 }}>
                        {j[t.key] && "✓"}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: j[t.key] ? 700 : 400, color: j[t.key] ? "#166534" : "#5a5048" }}>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {createModal && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setCreateModal(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Fraunces',serif" }}>Start Onboarding — {createModal.name}</div>
              <button className="btn-ghost" onClick={() => setCreateModal(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Joining Date</label>
                <input className="form-input" type="date" value={form.joining_date} onChange={(e) => setForm((f) => ({ ...f, joining_date: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-label">Location</label>
                <input className="form-input" placeholder="HQ / Site name" value={form.joining_location} onChange={(e) => setForm((f) => ({ ...f, joining_location: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-label">Type</label>
                <select className="form-input" value={form.joining_type} onChange={(e) => setForm((f) => ({ ...f, joining_type: e.target.value }))}>
                  <option value="hq">HQ</option>
                  <option value="site">Site</option>
                </select>
              </div>
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Reporting Manager Email</label>
                <input className="form-input" placeholder="manager@hagerstone.com" value={form.reporting_manager_email} onChange={(e) => setForm((f) => ({ ...f, reporting_manager_email: e.target.value }))} />
              </div>
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Employee ID (optional)</label>
                <input className="form-input" placeholder="HAG-2026-001" value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-outline" onClick={() => setCreateModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={startOnboarding} disabled={saving}>{saving ? "Saving..." : "Start Onboarding"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
