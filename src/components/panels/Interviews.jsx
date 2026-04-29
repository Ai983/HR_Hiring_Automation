import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { STAGE_META } from "../../constants.js";
import { fetchInterviews, createInterview, updateInterview, submitFeedback } from "../../services/interviewService.js";
import { updateApplicantStage } from "../../services/applicantService.js";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const MODAL = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };

const STATUS_COLOR = { scheduled: "#0ea5e9", completed: "#22c55e", cancelled: "#ef4444", rescheduled: "#f59e0b", no_show: "#8a7e72" };

export default function Interviews() {
  const { applicants, refreshApplicants, showToast } = useApp();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedModal, setSchedModal] = useState(null);
  const [fbModal, setFbModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [schedForm, setSchedForm] = useState({ interview_type: "hr", scheduled_at: "", duration_minutes: 60, mode: "google_meet", meet_link: "", panel: "", venue: "" });
  const [fbForm, setFbForm] = useState({ technical: 3, communication: 3, culture_fit: 3, recommendation: "hold", notes: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setInterviews(await fetchInterviews());
    setLoading(false);
  }

  const interviewApps = applicants.filter((a) => a.stage === "interview");

  async function scheduleInterview() {
    if (!schedForm.scheduled_at) return showToast("Select date and time.", false);
    setSaving(true);
    try {
      await createInterview({
        applicant_id: schedModal.id, ...schedForm,
        panel: schedForm.panel ? schedForm.panel.split(",").map((s) => s.trim()) : [],
      });
      // ensure applicant is in interview stage & sync kanban
      await updateApplicantStage(schedModal.id, "interview");
      await refreshApplicants();
      await load();
      setSchedModal(null);
      showToast("Interview scheduled.");
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  }

  async function saveFeedback() {
    setSaving(true);
    try {
      await submitFeedback(fbModal.id, fbForm);
      await updateApplicantStage(fbModal.applicant_id, fbForm.recommendation === "pass" ? "reference" : fbForm.recommendation === "fail" ? "rejected" : "interview");
      await refreshApplicants();
      await load();
      setFbModal(null);
      showToast("Feedback saved.");
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  }

  async function cancelInterview(id) {
    if (!window.confirm("Cancel this interview?")) return;
    await updateInterview(id, { status: "cancelled" });
    await load();
  }

  return (
    <div className="fade-in">
      <div className="page-title">Interviews</div>
      <div className="page-sub">Schedule and track all interview rounds. Log feedback after each session.</div>

      {interviewApps.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#5a5048", marginBottom: 12 }}>Ready to Schedule ({interviewApps.length})</div>
          {interviewApps.map((app) => (
            <div key={app.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0ece5" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0ece5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#5a5048" }}>{app.name?.[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{app.name}</div>
                <div style={{ fontSize: 11, color: "#8a7e72" }}>Score: {app.score}</div>
              </div>
              <button className="btn-gold" style={{ fontSize: 12, padding: "5px 14px" }} onClick={() => { setSchedModal(app); setSchedForm({ interview_type: "hr", scheduled_at: "", duration_minutes: 60, mode: "google_meet", meet_link: "", panel: "", venue: "" }); }}>
                Schedule
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
      ) : interviews.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "#8a7e72", padding: 40 }}>No interviews scheduled yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {interviews.map((iv) => (
            <div key={iv.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{iv.applicants?.full_name}</div>
                <div style={{ fontSize: 12, color: "#8a7e72" }}>{iv.applicants?.jobs?.title} · {iv.interview_type?.toUpperCase()} · {iv.mode?.replace("_", " ")}</div>
                <div style={{ fontSize: 12, color: "#5a5048", marginTop: 2 }}>{new Date(iv.scheduled_at).toLocaleString()}</div>
                {iv.meet_link && <a href={iv.meet_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#0ea5e9" }}>Meet Link</a>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[iv.status] || "#8a7e72", background: `${STATUS_COLOR[iv.status] || "#8a7e72"}18`, padding: "2px 8px", borderRadius: 20 }}>
                  {iv.status}
                </span>
                {iv.status === "scheduled" && (
                  <>
                    <button className="btn-outline" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { setFbModal(iv); setFbForm({ technical: 3, communication: 3, culture_fit: 3, recommendation: "hold", notes: "" }); }}>Mark Complete</button>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "#ef4444" }} onClick={() => cancelInterview(iv.id)}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {schedModal && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setSchedModal(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif" }}>Schedule Interview — {schedModal.name}</div>
              <button className="btn-ghost" onClick={() => setSchedModal(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Interview Type</label>
                <select className="form-input" value={schedForm.interview_type} onChange={(e) => setSchedForm((f) => ({ ...f, interview_type: e.target.value }))}>
                  <option value="hr">HR Round</option>
                  <option value="technical">Technical Round</option>
                  <option value="director">Director Round</option>
                  <option value="final">Final Round</option>
                </select>
              </div>
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Date &amp; Time</label>
                <input className="form-input" type="datetime-local" value={schedForm.scheduled_at} onChange={(e) => setSchedForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-label">Mode</label>
                <select className="form-input" value={schedForm.mode} onChange={(e) => setSchedForm((f) => ({ ...f, mode: e.target.value }))}>
                  <option value="google_meet">Google Meet</option>
                  <option value="in_person">In Person</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Duration (min)</label>
                <input className="form-input" type="number" value={schedForm.duration_minutes} onChange={(e) => setSchedForm((f) => ({ ...f, duration_minutes: +e.target.value }))} />
              </div>
              {schedForm.mode === "google_meet" && (
                <div className="form-field" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Meet Link</label>
                  <input className="form-input" placeholder="https://meet.google.com/..." value={schedForm.meet_link} onChange={(e) => setSchedForm((f) => ({ ...f, meet_link: e.target.value }))} />
                </div>
              )}
              {schedForm.mode === "in_person" && (
                <div className="form-field" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Venue</label>
                  <input className="form-input" placeholder="Office address / room" value={schedForm.venue} onChange={(e) => setSchedForm((f) => ({ ...f, venue: e.target.value }))} />
                </div>
              )}
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Panel Members (comma-separated emails)</label>
                <input className="form-input" placeholder="interviewer1@hagerstone.com, ..." value={schedForm.panel} onChange={(e) => setSchedForm((f) => ({ ...f, panel: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-outline" onClick={() => setSchedModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={scheduleInterview} disabled={saving}>{saving ? <><span className="spinner" /> Saving...</> : "Schedule"}</button>
            </div>
          </div>
        </div>
      )}

      {fbModal && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setFbModal(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif" }}>Interview Feedback</div>
              <button className="btn-ghost" onClick={() => setFbModal(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            {[["technical", "Technical Skills"], ["communication", "Communication"], ["culture_fit", "Culture Fit"]].map(([k, l]) => (
              <div key={k} className="form-field" style={{ marginBottom: 12 }}>
                <label className="form-label">{l}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setFbForm((f) => ({ ...f, [k]: n }))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: `2px solid ${fbForm[k] >= n ? "#f59e0b" : "#e5e7eb"}`, background: fbForm[k] >= n ? "#fef3c7" : "transparent", fontWeight: 700, cursor: "pointer" }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label className="form-label">Recommendation</label>
              <select className="form-input" value={fbForm.recommendation} onChange={(e) => setFbForm((f) => ({ ...f, recommendation: e.target.value }))}>
                <option value="pass">Hire — Move to Reference Check</option>
                <option value="hold">Hold</option>
                <option value="fail">Reject</option>
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="form-label">Comments</label>
              <textarea className="form-input" rows={3} value={fbForm.notes} onChange={(e) => setFbForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-outline" onClick={() => setFbModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={saveFeedback} disabled={saving}>{saving ? <><span className="spinner" /> Saving...</> : "Save Feedback"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
