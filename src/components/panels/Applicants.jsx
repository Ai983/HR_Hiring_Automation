import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { STAGES, STAGE_META, SOURCE_META } from "../../constants.js";
import { fmtDate } from "../../helpers.js";
import { updateApplicantStage, createApplicant } from "../../services/applicantService.js";
import { fetchInterviews } from "../../services/interviewService.js";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const MODAL = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const PORTAL_LIST = ["manual", "linkedin", "indeed", "jobhai", "apna", "email", "whatsapp", "facebook", "instagram"];

export default function Applicants() {
  const { jobs, applicants, setApplicants, refreshApplicants, selectedJob, setSelectedJob, setModal, setPanel, showToast } = useApp();

  const [dragOver, setDragOver] = useState(null);
  const [dragId, setDragId]     = useState(null);
  const [interviewMap, setInterviewMap] = useState({});
  const [quickAdd, setQuickAdd] = useState(null); // null | stage string
  const [qaForm, setQaForm]     = useState({ name: "", email: "", phone: "", jobId: "", portal: "manual" });
  const [qaSaving, setQaSaving] = useState(false);

  // fetch scheduled interviews to show badge on cards
  useEffect(() => {
    fetchInterviews().then((ivs) => {
      const map = {};
      ivs.forEach((iv) => {
        if (iv.status === "scheduled" && !map[iv.applicant_id]) map[iv.applicant_id] = iv;
      });
      setInterviewMap(map);
    });
  }, [applicants]);

  const moveStage = async (appId, newStage) => {
    setApplicants((prev) => prev.map((a) => (a.id === appId ? { ...a, stage: newStage } : a)));
    await updateApplicantStage(appId, newStage);
  };

  const handleDrop = (targetStage) => {
    if (dragId) moveStage(dragId, targetStage);
    setDragId(null);
    setDragOver(null);
  };

  const openQuickAdd = (stage) => {
    setQuickAdd(stage);
    setQaForm({ name: "", email: "", phone: "", jobId: selectedJob || "", portal: "manual" });
  };

  const saveQuickAdd = async () => {
    if (!qaForm.name.trim() || !qaForm.email.trim()) return showToast("Name and email are required.", false);
    setQaSaving(true);
    try {
      await createApplicant({
        full_name: qaForm.name.trim(),
        email: qaForm.email.trim(),
        phone: qaForm.phone.trim() || null,
        job_id: qaForm.jobId || null,
        portal: qaForm.portal,
        stage: quickAdd,
        applied_at: new Date().toISOString(),
      });
      await refreshApplicants();
      setQuickAdd(null);
      showToast("Applicant added.");
    } catch (e) {
      showToast(e.message, false);
    }
    setQaSaving(false);
  };

  const setResumeModal = (val) => setModal(val ? { type: "resumeUpload", data: val } : null);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="page-title">Applicants</div>
          <div className="page-sub">Drag cards to move stages · Click a card to view · + on a column to add directly</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="form-input" style={{ width: 220 }} value={selectedJob || ""} onChange={(e) => setSelectedJob(e.target.value || null)}>
            <option value="">All Jobs</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => openQuickAdd("new")}>+ Add Applicant</button>
          <button className="btn-gold" onClick={() => setResumeModal(selectedJob ? { jobId: selectedJob } : { jobId: "" })}>
            + Upload resume
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {STAGES.map((s) => {
          const count = applicants.filter((a) => a.stage === s && (!selectedJob || a.jobId === selectedJob)).length;
          return (
            <div key={s} style={{ background: "#fff", border: `1.5px solid ${STAGE_META[s].color}33`, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: STAGE_META[s].color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: STAGE_META[s].color }}>{STAGE_META[s].label}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1612", fontFamily: "'Fraunces',serif" }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Kanban */}
      <div className="kanban">
        {STAGES.map((s) => {
          const colApps = applicants.filter((a) => a.stage === s && (!selectedJob || a.jobId === selectedJob));
          const isOver  = dragOver === s;

          return (
            <div
              key={s}
              className="kanban-col"
              style={{
                background:  isOver ? STAGE_META[s].bg : undefined,
                outline:     isOver ? `2px dashed ${STAGE_META[s].color}` : undefined,
                outlineOffset: "2px",
                transition:  "background 0.15s, outline 0.15s",
                borderRadius: 12,
              }}
              onDragOver={(e)  => { e.preventDefault(); setDragOver(s); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
              onDrop={(e)      => { e.preventDefault(); handleDrop(s); }}
            >
              {/* Column header */}
              <div className="kanban-hdr" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: STAGE_META[s].color }} />
                {STAGE_META[s].label}
                <span style={{ marginLeft: "auto", background: STAGE_META[s].bg, color: STAGE_META[s].color, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>
                  {colApps.length}
                </span>
                <button
                  onClick={() => openQuickAdd(s)}
                  title={`Add applicant to ${STAGE_META[s].label}`}
                  style={{ background: "none", border: "none", cursor: "pointer", color: STAGE_META[s].color, fontWeight: 800, fontSize: 18, lineHeight: 1, padding: "0 2px", marginLeft: 2, opacity: 0.8 }}
                >
                  +
                </button>
              </div>

              {/* Cards */}
              {colApps.map((app) => {
                const job = jobs.find((j) => j.id === app.jobId);
                const src = SOURCE_META[app.portal] || SOURCE_META.manual;
                const iv  = interviewMap[app.id];
                const isDragging = dragId === app.id;

                return (
                  <div
                    key={app.id}
                    className="kanban-card"
                    draggable
                    onDragStart={(e) => { setDragId(app.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={()    => { setDragId(null); setDragOver(null); }}
                    onClick={() => setModal({ type: "applicant", data: app })}
                    style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab", userSelect: "none", transition: "opacity 0.15s" }}
                  >
                    <div className="k-name">{app.name}</div>
                    <div className="k-meta">{job?.title || "Unknown role"}</div>
                    <div className="k-meta" style={{ marginTop: 4 }}>
                      <span style={{ background: src.bg, color: src.color, padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                        {src.label}
                      </span>
                    </div>
                    <div className="k-score" style={{ color: app.score ? (app.score >= 85 ? "#22c55e" : app.score >= 70 ? "#f59e0b" : "#ef4444") : "#8a7e72" }}>
                      &#x25C9; {app.score ? `${app.score}/100` : "Not screened"}
                    </div>

                    {/* Interview badge */}
                    {iv && (
                      <div style={{ fontSize: 10, color: "#0ea5e9", marginTop: 5, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                        📅 {new Date(iv.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        <span style={{ background: "#0ea5e918", padding: "1px 5px", borderRadius: 8 }}>{iv.interview_type?.toUpperCase()}</span>
                      </div>
                    )}

                    {/* Schedule prompt for interview-stage cards with no scheduled interview */}
                    {s === "interview" && !iv && (
                      <button
                        className="btn-outline"
                        style={{ fontSize: 10, padding: "3px 8px", marginTop: 6, width: "100%", cursor: "pointer" }}
                        onClick={(e) => { e.stopPropagation(); setPanel("interviews"); }}
                      >
                        Schedule Interview →
                      </button>
                    )}

                    <div style={{ fontSize: 10, color: "#b0a898", marginTop: 4 }}>{fmtDate(app.appliedDate)}</div>
                  </div>
                );
              })}

              {colApps.length === 0 && (
                <div style={{
                  padding: "22px 0",
                  textAlign: "center",
                  fontSize: 12,
                  color: isOver ? STAGE_META[s].color : "#c4bdb2",
                  borderRadius: 10,
                  border: `1.5px dashed ${isOver ? STAGE_META[s].color : "#e8e2d9"}`,
                  transition: "all 0.15s",
                }}>
                  {isOver ? "Drop here" : "Empty"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Add Applicant Modal */}
      {quickAdd !== null && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setQuickAdd(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif" }}>Add Applicant</div>
                <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 3 }}>
                  Adding to stage:&nbsp;
                  <span style={{ color: STAGE_META[quickAdd].color, fontWeight: 700 }}>{STAGE_META[quickAdd].label}</span>
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setQuickAdd(null)} style={{ fontSize: 18 }}>✕</button>
            </div>

            <div className="form-grid">
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  value={qaForm.name}
                  onChange={(e) => setQaForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Applicant full name"
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label className="form-label">Email *</label>
                <input
                  className="form-input"
                  type="email"
                  value={qaForm.email}
                  onChange={(e) => setQaForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Phone</label>
                <input
                  className="form-input"
                  value={qaForm.phone}
                  onChange={(e) => setQaForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91..."
                />
              </div>
              <div className="form-field">
                <label className="form-label">Job Role</label>
                <select className="form-input" value={qaForm.jobId} onChange={(e) => setQaForm((f) => ({ ...f, jobId: e.target.value }))}>
                  <option value="">— No specific job —</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Source</label>
                <select className="form-input" value={qaForm.portal} onChange={(e) => setQaForm((f) => ({ ...f, portal: e.target.value }))}>
                  {PORTAL_LIST.map((p) => (
                    <option key={p} value={p}>{SOURCE_META[p]?.label || p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-outline" onClick={() => setQuickAdd(null)}>Cancel</button>
              <button className="btn-gold" onClick={saveQuickAdd} disabled={qaSaving}>
                {qaSaving ? <><span className="spinner" /> Saving...</> : "Save Applicant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
