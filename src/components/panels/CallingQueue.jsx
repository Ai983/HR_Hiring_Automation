import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { STAGE_META } from "../../constants.js";
import { fetchCallQueue, fetchCallLogs, createCallLog, countCallAttempts } from "../../services/callService.js";
import { updateApplicantStage } from "../../services/applicantService.js";
import { generateCallPrep } from "../../services/aiService.js";

const OUTCOME_LABELS = {
  connected:          "Connected",
  not_picked:         "Not Picked",
  callback_requested: "Callback Requested",
  rejected_on_call:   "Rejected on Call",
  moved_to_interview: "Moved to Interview",
};

const OVERLAY = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};
const MODAL = {
  background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520,
  maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
};

export default function CallingQueue() {
  const { refreshApplicants, showToast } = useApp();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalApp, setModalApp] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [prep, setPrep] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [form, setForm] = useState({ called_by: "HR", call_status: "connected", call_notes: "", callback_time: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setQueue(await fetchCallQueue());
    setLoading(false);
  }

  async function openModal(app) {
    setModalApp(app);
    setPrep(null);
    setForm({ called_by: "HR", call_status: "connected", call_notes: "", callback_time: "" });
    const logs = await fetchCallLogs(app.id);
    setCallLogs(logs);
  }

  async function loadCallPrep() {
    if (!modalApp) return;
    setPrepLoading(true);
    try {
      const result = await generateCallPrep(modalApp.id);
      setPrep(result);
    } catch {
      showToast("Call prep generation failed.", false);
    }
    setPrepLoading(false);
  }

  async function submitLog() {
    if (!form.called_by.trim()) return showToast("Enter caller name.", false);
    setSaving(true);
    try {
      await createCallLog({ applicant_id: modalApp.id, ...form, callback_time: form.callback_time || null });
      if (form.call_status === "moved_to_interview") {
        await updateApplicantStage(modalApp.id, "interview");
      } else if (form.call_status === "rejected_on_call") {
        await updateApplicantStage(modalApp.id, "rejected");
      } else if (form.call_status === "connected" || form.call_status === "callback_requested") {
        await updateApplicantStage(modalApp.id, "calling");
      }
      await refreshApplicants();
      await load();
      setModalApp(null);
      showToast("Call logged.");
    } catch (e) {
      showToast(e.message, false);
    }
    setSaving(false);
  }

  return (
    <div className="fade-in">
      <div className="page-title">Calling Queue</div>
      <div className="page-sub">Shortlisted candidates ready to call, sorted by AI score. Log every call outcome.</div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#8a7e72" }}><span className="spinner" /></div>
      ) : queue.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "#8a7e72", padding: 40 }}>
          No shortlisted candidates in queue.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {queue.map((app) => {
            const attempts = (app.call_logs || []).length;
            const lastLog = app.call_logs?.[0];
            return (
              <div key={app.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0ece5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#5a5048", flexShrink: 0 }}>
                  {app.full_name?.[0] || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1612" }}>{app.full_name}</div>
                  <div style={{ fontSize: 12, color: "#8a7e72" }}>{app.jobs?.title || "—"}</div>
                  {app.phone && <div style={{ fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>{app.phone}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {app.ai_score > 0 && (
                    <span style={{ background: "#f59e0b22", color: "#b45309", padding: "2px 8px", borderRadius: 20, fontWeight: 800, fontSize: 12 }}>
                      {app.ai_score}
                    </span>
                  )}
                  <span style={{ ...STAGE_META[app.stage], padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {STAGE_META[app.stage]?.label}
                  </span>
                  {attempts > 0 && (
                    <span style={{ fontSize: 11, color: "#8a7e72" }}>{attempts} call{attempts !== 1 ? "s" : ""} logged</span>
                  )}
                  {lastLog && (
                    <span style={{ fontSize: 10, color: "#b0a898" }}>{OUTCOME_LABELS[lastLog.call_status] || lastLog.call_status}</span>
                  )}
                </div>
                <button className="btn-gold" style={{ flexShrink: 0 }} onClick={() => openModal(app)}>Log Call</button>
              </div>
            );
          })}
        </div>
      )}

      {modalApp && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setModalApp(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif" }}>{modalApp.full_name}</div>
                <div style={{ fontSize: 13, color: "#8a7e72" }}>{modalApp.jobs?.title} · {modalApp.phone || "No phone"}</div>
              </div>
              <button className="btn-ghost" onClick={() => setModalApp(null)} style={{ fontSize: 18, color: "#8a7e72" }}>✕</button>
            </div>

            <button className="btn-outline" style={{ marginBottom: 16, width: "100%", justifyContent: "center", fontSize: 12 }} onClick={loadCallPrep} disabled={prepLoading}>
              {prepLoading ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Generating...</> : "✦ AI Call Prep Card"}
            </button>

            {prep && (
              <div style={{ background: "#faf8f5", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 12 }}>
                {Object.entries(prep).map(([k, v]) => v && (
                  <div key={k} style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: "#5a5048", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}: </span>
                    <span style={{ color: "#1a1612" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="form-grid">
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Called By</label>
                <input className="form-input" value={form.called_by} onChange={(e) => setForm((f) => ({ ...f, called_by: e.target.value }))} />
              </div>
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Outcome</label>
                <select className="form-input" value={form.call_status} onChange={(e) => setForm((f) => ({ ...f, call_status: e.target.value }))}>
                  {Object.entries(OUTCOME_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {form.call_status === "callback_requested" && (
                <div className="form-field" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Callback Time</label>
                  <input className="form-input" type="datetime-local" value={form.callback_time} onChange={(e) => setForm((f) => ({ ...f, callback_time: e.target.value }))} />
                </div>
              )}
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={form.call_notes} onChange={(e) => setForm((f) => ({ ...f, call_notes: e.target.value }))} placeholder="What did you discuss? Any concerns?" />
              </div>
            </div>

            {callLogs.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8a7e72", textTransform: "uppercase", marginBottom: 8 }}>Previous Calls</div>
                {callLogs.slice(0, 3).map((l) => (
                  <div key={l.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: "1px solid #f0ece5", color: "#5a5048" }}>
                    <span style={{ fontWeight: 600 }}>{OUTCOME_LABELS[l.call_status]}</span>
                    {l.call_notes && <span> — {l.call_notes}</span>}
                    <span style={{ color: "#b0a898", float: "right" }}>{new Date(l.call_date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-outline" onClick={() => setModalApp(null)}>Cancel</button>
              <button className="btn-gold" onClick={submitLog} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving...</> : "Save Log"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
