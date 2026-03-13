import { useApp } from "../../context/AppContext.jsx";
import { STAGES, STAGE_META, PORTALS } from "../../constants.js";
import { fmtDate } from "../../helpers.js";
import { updateApplicantStage } from "../../services/applicantService.js";

export default function Applicants() {
  const { jobs, applicants, setApplicants, selectedJob, setSelectedJob, setModal, showToast } = useApp();

  const moveStage = async (appId, newStage) => {
    setApplicants((prev) => prev.map((a) => (a.id === appId ? { ...a, stage: newStage } : a)));
    await updateApplicantStage(appId, newStage);
  };

  const setResumeModal = (val) => setModal(val ? { type: "resumeUpload", data: val } : null);

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="page-title">Applicants</div>
          <div className="page-sub">Kanban - move stages manually; upload resumes and run AI screening</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="form-input" style={{ width: 220 }} value={selectedJob || ""} onChange={(e) => setSelectedJob(e.target.value || null)}>
            <option value="">All Jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <button className="btn-gold" onClick={() => setResumeModal(selectedJob ? { jobId: selectedJob } : { jobId: "" })}>
            + Upload resume
          </button>
        </div>
      </div>

      {/* Summary row */}
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
          return (
            <div key={s} className="kanban-col">
              <div className="kanban-hdr">
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: STAGE_META[s].color }} />
                {STAGE_META[s].label}
                <span style={{ marginLeft: "auto", background: STAGE_META[s].bg, color: STAGE_META[s].color, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>
                  {colApps.length}
                </span>
              </div>
              {colApps.map((app) => {
                const job = jobs.find((j) => j.id === app.jobId);
                const portal = PORTALS.find((x) => x.id === app.portal) || {};
                return (
                  <div key={app.id} className="kanban-card" onClick={() => setModal({ type: "applicant", data: app })}>
                    <div className="k-name">{app.name}</div>
                    <div className="k-meta">{job?.title || "Unknown role"}</div>
                    <div className="k-meta" style={{ marginTop: 4 }}>
                      <span style={{ background: portal.bg || "#f0ece5", color: portal.color || "#5a5048", padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                        {portal.label || app.portal}
                      </span>
                    </div>
                    <div className="k-score" style={{ color: app.score != null ? (app.score >= 85 ? "#22c55e" : app.score >= 70 ? "#f59e0b" : "#ef4444") : "#8a7e72" }}>
                      &#x25C9; {app.score != null ? `${app.score}/100` : "Not screened"}
                    </div>
                    <div style={{ fontSize: 10, color: "#b0a898", marginTop: 4 }}>{fmtDate(app.appliedDate)}</div>
                  </div>
                );
              })}
              {colApps.length === 0 && (
                <div style={{ padding: "14px 0", textAlign: "center", fontSize: 12, color: "#c4bdb2", borderRadius: 10, border: "1.5px dashed #e8e2d9" }}>Empty</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
