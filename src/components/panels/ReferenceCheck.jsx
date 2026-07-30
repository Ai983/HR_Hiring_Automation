import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { fetchAllPendingReferences, createReference, updateReference } from "../../services/referenceService.js";
import { updateApplicantStage } from "../../services/applicantService.js";
import { summarizeReference } from "../../services/aiService.js";

const VERDICT_COLORS = { STRONG_HIRE: "#10b981", HIRE: "#22c55e", HOLD: "#f59e0b", NO_HIRE: "#ef4444" };

// The model returns these as either a string or a list depending on the run —
// normalise so the panel never crashes on .join().
const asText = (v) => (Array.isArray(v) ? v.filter(Boolean).join(" · ") : (v || "").toString().trim());

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const MODAL = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };

const STATUS_COLORS = { pending: "#f59e0b", contacted: "#0ea5e9", completed: "#22c55e", unreachable: "#ef4444" };

export default function ReferenceCheck() {
  const { applicants, refreshApplicants, showToast } = useApp();
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(null);
  const [logModal, setLogModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ referee_name: "", referee_designation: "", referee_company: "", referee_phone: "", referee_email: "", relationship: "Direct Manager" });
  const [logForm, setLogForm] = useState({ reference_status: "contacted", feedback_rating: 4, feedback_notes: "", checked_by: "HR" });
  const [summary, setSummary] = useState({});   // applicantId -> AI verdict
  const [summId, setSummId]   = useState(null);

  async function loadSummary(applicantId) {
    setSummId(applicantId);
    try {
      const result = await summarizeReference(applicantId);
      setSummary((s) => ({ ...s, [applicantId]: result }));
    } catch (e) { showToast(e.message || "Could not summarise the references.", false); }
    setSummId(null);
  }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setRefs(await fetchAllPendingReferences());
    setLoading(false);
  }

  const refApps = applicants.filter((a) => a.stage === "reference");

  async function addRef() {
    if (!addForm.referee_name.trim()) return showToast("Referee name required.", false);
    setSaving(true);
    try {
      await createReference({ applicant_id: addModal.id, ...addForm });
      await load();
      setAddModal(null);
      showToast("Referee added.");
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  }

  async function saveLog() {
    setSaving(true);
    try {
      await updateReference(logModal.id, {
        ...logForm, checked_at: new Date().toISOString(),
      });
      if (logForm.reference_status === "completed") {
        const allDone = refs.filter((r) => r.applicant_id === logModal.applicant_id && r.id !== logModal.id).every((r) => r.reference_status === "completed");
        if (allDone) {
          await updateApplicantStage(logModal.applicant_id, "offer");
          await refreshApplicants();
          showToast("All references complete. Moved to Offer stage.");
        }
      }
      await load();
      setLogModal(null);
      if (logForm.reference_status !== "completed") showToast("Reference updated.");
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  }

  const groupedByApplicant = refs.reduce((acc, r) => {
    const key = r.applicant_id;
    if (!acc[key]) acc[key] = { name: r.applicants?.full_name, role: r.applicants?.jobs?.title, refs: [] };
    acc[key].refs.push(r);
    return acc;
  }, {});

  return (
    <div className="fade-in">
      <div className="page-title">Reference Check</div>
      <div className="page-sub">Collect and log referee details for candidates in the Reference stage.</div>

      {refApps.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#5a5048", marginBottom: 12 }}>Candidates Ready ({refApps.length})</div>
          {refApps.map((app) => (
            <div key={app.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0ece5" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{app.name}</div>
                <div style={{ fontSize: 11, color: "#8a7e72" }}>Score: {app.score}</div>
              </div>
              <button className="btn-outline" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => { setAddModal(app); setAddForm({ referee_name: "", referee_designation: "", referee_company: "", referee_phone: "", referee_email: "", relationship: "Direct Manager" }); }}>
                + Add Referee
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : (
        Object.keys(groupedByApplicant).length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "#8a7e72", padding: 40 }}>No pending reference checks.</div>
        ) : (
          Object.entries(groupedByApplicant).map(([id, grp]) => (
            <div key={id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{grp.name} <span style={{ color: "#8a7e72", fontWeight: 400, fontSize: 12 }}>— {grp.role}</span></div>
                {!summary[id] && (
                  <button className="btn-outline" style={{ fontSize: 11, padding: "3px 10px" }}
                    onClick={() => loadSummary(id)} disabled={summId === id}>
                    {summId === id ? <><span className="spinner" /> Summarising…</> : "✦ AI Reference Summary"}
                  </button>
                )}
              </div>

              {summary[id] && (
                <div style={{ background: "#faf8f5", borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 11, padding: "2px 9px", borderRadius: 20,
                      color: VERDICT_COLORS[summary[id].overall_verdict] || "#8a7e72",
                      background: `${VERDICT_COLORS[summary[id].overall_verdict] || "#8a7e72"}18` }}>
                      {String(summary[id].overall_verdict || "—").replace(/_/g, " ")}
                    </span>
                    <span style={{ color: "#8a7e72" }}>
                      {summary[id].ref_count} reference(s) · avg ★ {summary[id].average_rating}/5
                    </span>
                  </div>
                  {summary[id].summary && <div style={{ color: "#1a1612", marginBottom: 6 }}>{summary[id].summary}</div>}
                  {asText(summary[id].consistent_strengths) && (
                    <div style={{ color: "#16a34a" }}>✓ {asText(summary[id].consistent_strengths)}</div>
                  )}
                  {asText(summary[id].red_flags) && !/^none/i.test(asText(summary[id].red_flags)) && (
                    <div style={{ color: "#dc2626", marginTop: 2 }}>⚠ {asText(summary[id].red_flags)}</div>
                  )}
                </div>
              )}
              {grp.refs.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f0ece5" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.referee_name}</div>
                    <div style={{ fontSize: 11, color: "#8a7e72" }}>{r.referee_designation} @ {r.referee_company} · {r.referee_phone}</div>
                    {r.feedback_notes && <div style={{ fontSize: 11, color: "#5a5048", marginTop: 2 }}>{r.feedback_notes}</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[r.reference_status], background: `${STATUS_COLORS[r.reference_status]}18`, padding: "2px 8px", borderRadius: 20 }}>
                    {r.reference_status}
                  </span>
                  {r.feedback_rating && (
                    <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>★ {r.feedback_rating}/5</span>
                  )}
                  {r.reference_status !== "completed" && (
                    <button className="btn-outline" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { setLogModal(r); setLogForm({ reference_status: "contacted", feedback_rating: 4, feedback_notes: "", checked_by: "HR" }); }}>
                      Log
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )
      )}

      {addModal && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setAddModal(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Fraunces',serif" }}>Add Referee — {addModal.name}</div>
              <button className="btn-ghost" onClick={() => setAddModal(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="form-grid">
              {[["referee_name", "Referee Name *"], ["referee_designation", "Designation"], ["referee_company", "Company"], ["referee_phone", "Phone"], ["referee_email", "Email"]].map(([k, l]) => (
                <div key={k} className="form-field" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">{l}</label>
                  <input className="form-input" value={addForm[k]} onChange={(e) => setAddForm((f) => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Relationship</label>
                <select className="form-input" value={addForm.relationship} onChange={(e) => setAddForm((f) => ({ ...f, relationship: e.target.value }))}>
                  {["Direct Manager", "Colleague", "Client", "HR"].map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-outline" onClick={() => setAddModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={addRef} disabled={saving}>{saving ? "Saving..." : "Add Referee"}</button>
            </div>
          </div>
        </div>
      )}

      {logModal && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setLogModal(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Fraunces',serif" }}>Log Reference — {logModal.referee_name}</div>
              <button className="btn-ghost" onClick={() => setLogModal(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label className="form-label">Status</label>
              <select className="form-input" value={logForm.reference_status} onChange={(e) => setLogForm((f) => ({ ...f, reference_status: e.target.value }))}>
                {Object.keys(STATUS_COLORS).map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label className="form-label">Rating (1–5)</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setLogForm((f) => ({ ...f, feedback_rating: n }))}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `2px solid ${logForm.feedback_rating >= n ? "#f59e0b" : "#e5e7eb"}`, background: logForm.feedback_rating >= n ? "#fef3c7" : "transparent", fontWeight: 700, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} value={logForm.feedback_notes} onChange={(e) => setLogForm((f) => ({ ...f, feedback_notes: e.target.value }))} />
            </div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="form-label">Checked By</label>
              <input className="form-input" value={logForm.checked_by} onChange={(e) => setLogForm((f) => ({ ...f, checked_by: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-outline" onClick={() => setLogModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={saveLog} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
