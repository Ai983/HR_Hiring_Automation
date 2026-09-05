import { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { STAGES, STAGE_META, SOURCE_META } from "../../constants.js";
import { fmtDate } from "../../helpers.js";
import { updateApplicantStage, createApplicant, uploadResumeFile, screenApplicant, checkDuplicate } from "../../services/applicantService.js";
import { resolveJobIdForRole } from "../../services/jobService.js";
import { extractResumeText, parseResumeInfo } from "../../services/resumeParser.js";
import { fetchInterviews } from "../../services/interviewService.js";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const MODAL = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const PORTAL_LIST = ["manual", "linkedin", "indeed", "jobhai", "apna", "email", "whatsapp", "facebook", "instagram"];

// The candidate-facing application form (`/apply.html`). Resolved the same way
// emailService.js resolves its link target: VITE_HUB_URL when the admin app and
// the public pages are on different hosts, otherwise the current origin. Never
// hardcode the vercel.app domain — a link copied while testing on localhost
// would then silently point real candidates at production, or vice versa.
const APPLY_URL = `${
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_HUB_URL) ||
  (typeof window !== "undefined" ? window.location.origin : "")
}/apply.html`;

export default function Applicants() {
  const { jobs, setJobs, applicants, setApplicants, refreshApplicants, selectedJob, setSelectedJob, setModal, setPanel, showToast } = useApp();

  const [dragOver, setDragOver] = useState(null);
  const [dragId, setDragId]     = useState(null);
  const [interviewMap, setInterviewMap] = useState({});
  const [quickAdd, setQuickAdd] = useState(null); // null | stage string
  const [qaForm, setQaForm]     = useState({ name: "", email: "", phone: "", jobId: "", portal: "manual" });
  const [qaCustomRole, setQaCustomRole] = useState("");
  const [qaSaving, setQaSaving] = useState(false);
  const [qaResume, setQaResume]   = useState(null);
  const [qaResumeText, setQaResumeText] = useState("");
  const [qaParsing, setQaParsing] = useState(false);
  const qaFileRef = useRef(null);

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
    setQaCustomRole("");
    setQaResume(null);
    setQaResumeText("");
    setQaParsing(false);
  };

  const handleQaResume = async (file) => {
    if (!file) { setQaResume(null); setQaResumeText(""); return; }
    setQaResume(file);
    setQaParsing(true);
    try {
      const text = await extractResumeText(file);
      setQaResumeText(text || "");
      if (text) {
        const { name, email, phone } = parseResumeInfo(text);
        setQaForm((f) => ({
          ...f,
          name:  name  || f.name,
          email: email || f.email,
          phone: phone || f.phone,
        }));
        showToast("Resume parsed — fields auto-filled. Please verify before saving.");
      } else {
        showToast("No text found in resume. Fill fields manually.", false);
      }
    } catch {
      showToast("Could not read resume. Fill fields manually.", false);
    }
    setQaParsing(false);
  };

  const saveQuickAdd = async () => {
    if (!qaForm.name.trim() || !qaForm.email.trim()) return showToast("Name and email are required.", false);
    // applicants.job_id is NOT NULL — without this guard the insert dies with a raw Postgres error.
    if (!qaForm.jobId) return showToast("Pick a job role — an applicant must be attached to a role.", false);
    if (qaForm.jobId === "__custom__" && !qaCustomRole.trim()) return showToast("Enter the custom job role title.", false);
    setQaSaving(true);
    try {
      const dupe = await checkDuplicate(qaForm.email.trim(), qaForm.phone.trim());
      if (dupe) {
        setQaSaving(false);
        return showToast(`Already in the pipeline: ${dupe.full_name} (${dupe.stage}).`, false);
      }
      // Resolve custom role to a real job ID
      let resolvedJobId = qaForm.jobId;
      if (qaForm.jobId === "__custom__" && qaCustomRole.trim()) {
        resolvedJobId = await resolveJobIdForRole(jobs, qaCustomRole.trim(), "", setJobs);
        if (!resolvedJobId) { showToast("Could not create custom role. Try again.", false); setQaSaving(false); return; }
      }

      let resumePath = null;
      if (qaResume && resolvedJobId) {
        const ext = qaResume.name.split(".").pop() || "pdf";
        resumePath = `${resolvedJobId}/${crypto.randomUUID()}.${ext}`;
        await uploadResumeFile(resumePath, qaResume);
      }
      const newApp = await createApplicant({
        full_name: qaForm.name.trim(),
        email: qaForm.email.trim(),
        phone: qaForm.phone.trim() || null,
        job_id: resolvedJobId || null,
        portal: qaForm.portal,
        stage: quickAdd,
        applied_at: new Date().toISOString(),
        resume_path: resumePath,
        resume_text: qaResumeText || null,
      });
      setApplicants((prev) => [newApp, ...prev]);
      setQuickAdd(null);
      showToast("Applicant added.");
      if (qaResumeText?.trim() && newApp.id) {
        try {
          const data = await screenApplicant(newApp.id);
          setApplicants((prev) =>
            prev.map((a) =>
              a.id === newApp.id
                ? { ...a, score: data.score, shortlisted: data.shortlisted, screening_notes: data.screening_notes }
                : a
            )
          );
          showToast(`AI Score: ${data.score}/100${data.shortlisted ? " · Shortlisted ✓" : ""}`);
        } catch {
          showToast("AI screening failed — open applicant card to retry.", false);
        }
      }
    } catch (e) {
      showToast(e.message, false);
    }
    setQaSaving(false);
  };

  const setResumeModal = (val) => setModal(val ? { type: "resumeUpload", data: val } : null);

  // Copy the public form link so HR can paste it into WhatsApp or an email.
  // navigator.clipboard needs a secure context and is not there on every
  // browser the office uses, so the textarea fallback is not optional —
  // without it the button looks like it did nothing.
  const copyApplyLink = async () => {
    try {
      await navigator.clipboard.writeText(APPLY_URL);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = APPLY_URL;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast("Application form link copied — paste it into WhatsApp or email.");
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="page-title">Applicants</div>
          <div className="page-sub">
            Drag cards to move stages · Click a card to view · + on a column to add directly
          </div>
          <div className="page-sub" style={{ marginTop: 4 }}>
            Candidates can apply themselves at{" "}
            <code style={{ fontSize: 12 }}>/apply.html</code> — submissions arrive in{" "}
            <b>New</b> tagged <b>Self-applied</b>.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="form-input" style={{ width: 220 }} value={selectedJob || ""} onChange={(e) => setSelectedJob(e.target.value || null)}>
            <option value="">All Jobs</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          {/* The public form link. It lives here rather than on the Dashboard
              because this is the panel HR is on when they are thinking about
              candidates — and it is where the submissions land. */}
          <button
            className="btn-outline"
            style={{ fontSize: 12 }}
            onClick={copyApplyLink}
            title={`Copy ${APPLY_URL}`}
          >
            🔗 Copy form link
          </button>
          <a
            className="btn-outline"
            style={{ fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            href={APPLY_URL}
            target="_blank"
            rel="noreferrer"
            title="Open the candidate form in a new tab"
          >
            Preview
          </a>
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
                    {/* A self-applied candidate has no job_id yet — they typed a
                        designation, and HR attaches them to a real opening later.
                        Falling through to the designation stops every form
                        submission rendering as "Unknown role". */}
                    <div className="k-meta">{job?.title || app.designation || "Unknown role"}</div>
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

            {/* Resume upload — auto-fills fields */}
            <div
              style={{ border: "2px dashed #e8e2d9", borderRadius: 12, padding: "14px 16px", marginBottom: 18, background: qaResume ? "rgba(34,197,94,0.04)" : "#faf8f5", cursor: "pointer", transition: "border-color 0.15s", borderColor: qaResume ? "#22c55e" : "#e8e2d9" }}
              onClick={() => qaFileRef.current?.click()}
            >
              <input
                ref={qaFileRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: "none" }}
                onChange={(e) => handleQaResume(e.target.files?.[0] || null)}
              />
              {qaParsing ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#c97a2a" }}>
                  <span className="spinner" /> Parsing resume…
                </div>
              ) : qaResume ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1612" }}>{qaResume.name}</div>
                    <div style={{ fontSize: 11, color: "#22c55e", marginTop: 2 }}>✓ Parsed — fields auto-filled · Click to change</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#8a7e72" }}>
                  <span style={{ fontSize: 24 }}>📋</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Upload Resume (optional)</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>PDF or DOCX · Auto-fills name, email & phone</div>
                  </div>
                </div>
              )}
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
                <label className="form-label">Job Role *</label>
                <select
                  className="form-input"
                  value={qaForm.jobId}
                  onChange={(e) => { setQaForm((f) => ({ ...f, jobId: e.target.value })); setQaCustomRole(""); }}
                >
                  <option value="">— Select a role —</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                  <option value="__custom__">✏ Type custom role…</option>
                </select>
                {qaForm.jobId === "__custom__" && (
                  <input
                    className="form-input"
                    style={{ marginTop: 6 }}
                    value={qaCustomRole}
                    onChange={(e) => setQaCustomRole(e.target.value)}
                    placeholder="e.g. Store Manager, Accountant…"
                    autoFocus
                  />
                )}
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
              <button className="btn-gold" onClick={saveQuickAdd} disabled={qaSaving || qaParsing}>
                {qaSaving
                  ? <><span className="spinner" /> {qaResume ? "Uploading & Screening…" : "Saving…"}</>
                  : qaResume ? "Save & Screen with AI" : "Save Applicant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
