import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS, STAGE_META } from "../../constants.js";
import { fmtDate } from "../../helpers.js";

export default function ResumeReport() {
  const { jobs, applicants, setModal } = useApp();

  const [selectedJobId, setSelectedJobId] = useState("");
  const [shortlistedOnly, setShortlistedOnly] = useState(false);

  // Filter applicants that have been screened (ai_score > 0)
  const screenedApplicants = applicants
    .filter((a) => {
      if (selectedJobId && a.jobId !== selectedJobId) return false;
      if (a.score == null || a.score === 0) return false;
      if (shortlistedOnly && !a.shortlisted) return false;
      return true;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const avgScore = screenedApplicants.length ? Math.round(screenedApplicants.reduce((s, a) => s + (a.score || 0), 0) / screenedApplicants.length) : 0;
  const shortlistedCount = screenedApplicants.filter((a) => a.shortlisted).length;

  const scoreColor = (score) => {
    if (score >= 85) return "#22c55e";
    if (score >= 70) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="fade-in">
      <div className="page-title">Resume Screening Report</div>
      <div className="page-sub">All screened applicants ranked by AI score in descending order.</div>

      <div className="report-filter-row">
        <select className="form-input" style={{ width: 240 }} value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
          <option value="">All Jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#5a5048", cursor: "pointer" }}>
          <input type="checkbox" checked={shortlistedOnly} onChange={(e) => setShortlistedOnly(e.target.checked)} style={{ accentColor: "#c97a2a" }} />
          Shortlisted only
        </label>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        {[
          { val: screenedApplicants.length, lbl: "Total Screened" },
          { val: avgScore, lbl: "Avg. Score" },
          { val: shortlistedCount, lbl: "Shortlisted" },
        ].map((s) => (
          <div key={s.lbl} className="report-stat">
            <div className="report-stat-val">{s.val}</div>
            <div className="report-stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      {screenedApplicants.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "#8a7e72" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#x2630;</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No screened applicants found.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Upload resumes and run AI screening from the Applicants panel first.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Portal</th>
                <th>AI Score</th>
                <th>Shortlisted</th>
                <th>Notes</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {screenedApplicants.map((app, i) => {
                const portal = PORTALS.find((p) => p.id === app.portal) || {};
                const job = jobs.find((j) => j.id === app.jobId);
                return (
                  <tr key={app.id} onClick={() => setModal({ type: "applicant", data: app })}>
                    <td>
                      <span
                        className="report-rank"
                        style={{
                          background: i < 3 ? "linear-gradient(135deg,#e8a24a,#c97a2a)" : "#f0ece5",
                          color: i < 3 ? "#fff" : "#5a5048",
                        }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{app.name}</div>
                      {job && <div style={{ fontSize: 11, color: "#8a7e72" }}>{job.title}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{app.email}</td>
                    <td>
                      <span
                        style={{
                          background: portal.bg || "#f0ece5",
                          color: portal.color || "#5a5048",
                          padding: "2px 8px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {portal.label || app.portal}
                      </span>
                    </td>
                    <td>
                      <span className="report-score" style={{ color: scoreColor(app.score) }}>
                        {app.score}
                      </span>
                      <span style={{ fontSize: 11, color: "#8a7e72" }}>/100</span>
                    </td>
                    <td>
                      {app.shortlisted ? (
                        <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}>&#10003;</span>
                      ) : (
                        <span style={{ color: "#c4bdb2" }}>&mdash;</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {app.screening_notes || "\u2014"}
                    </td>
                    <td>
                      <span
                        className="tag"
                        style={{
                          background: STAGE_META[app.stage]?.bg || "#f0ece5",
                          color: STAGE_META[app.stage]?.color || "#5a5048",
                        }}
                      >
                        {STAGE_META[app.stage]?.label || app.stage}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
