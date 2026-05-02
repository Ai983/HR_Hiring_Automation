import { useApp } from "../../context/AppContext.jsx";
import { PORTALS, STATUS_META } from "../../constants.js";
import { fmtDate, totalApplicants } from "../../helpers.js";
import { updatePortalStatus } from "../../services/jobService.js";

export default function AllJobs() {
  const { jobs, setJobs, applicants, setPanel, setSelectedJob, showToast } = useApp();

  const liveJobs = jobs.filter((j) => PORTALS.some((p) => j[p.id]?.status === "live")).length;

  const togglePortal = async (jobId, portal) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const cur = job[portal]?.status;
    const next = cur === "live" ? "paused" : cur === "paused" ? "live" : cur;

    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== jobId) return j;
        return { ...j, [portal]: { ...j[portal], status: next } };
      })
    );

    const ps = {};
    PORTALS.forEach((p) => {
      ps[p.id] = job[p.id] || { status: "draft", applicants: 0, views: 0 };
    });
    ps[portal] = { ...ps[portal], ...job[portal], status: next };
    await updatePortalStatus(jobId, ps);
    showToast(`${PORTALS.find((p) => p.id === portal)?.label} posting ${cur === "live" ? "paused" : "resumed"}.`);
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="page-title">All Jobs</div>
          <div className="page-sub">
            {jobs.length} total &middot; {liveJobs} live
          </div>
        </div>
        <button className="btn-gold" onClick={() => setPanel("post")}>
          + Post a Job
        </button>
      </div>

      {jobs.map((job) => (
        <div key={job.id} className="card" style={{ marginBottom: 12, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="job-title">{job.title}</span>
                <span className="tag" style={{ background: "#f0ece5", color: "#5a5048", fontSize: 11 }}>
                  {job.type}
                </span>
              </div>
              <div className="job-meta">
                {job.dept} &middot; {job.location} &middot; Posted {fmtDate(job.postedDate)}
              </div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(job.skills || []).slice(0, 4).map((s) => (
                  <span key={s} className="skill-pill" style={{ fontSize: 11, padding: "2px 10px" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Portal status columns */}
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              {PORTALS.map((p) => {
                const data = job[p.id];
                if (!data)
                  return (
                    <div key={p.id} style={{ width: 130, padding: "12px 14px", background: "#faf8f5", borderRadius: 10, border: "1px solid #ede6db", opacity: 0.5, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#b0a898" }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: "#c4bdb2", marginTop: 4 }}>Not posted</div>
                    </div>
                  );
                return (
                  <div key={p.id} style={{ width: 130, padding: "12px 14px", background: p.bg, borderRadius: 10, border: `1px solid ${p.color}22` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: p.color }}>{p.label}</span>
                      <span className="tag" style={{ background: STATUS_META[data.status].bg, color: STATUS_META[data.status].color, fontSize: 10 }}>
                        {STATUS_META[data.status].label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#5a5048" }}>{data.applicants} applicants</div>
                    <div style={{ fontSize: 11, color: "#8a7e72" }}>{data.views} views</div>
                    {data.status !== "closed" && (
                      <button
                        onClick={() => togglePortal(job.id, p.id)}
                        style={{
                          marginTop: 8, fontSize: 11, fontWeight: 600, padding: "3px 10px",
                          borderRadius: 6, border: `1px solid ${p.color}44`, background: "transparent",
                          color: p.color, cursor: "pointer",
                        }}
                      >
                        {data.status === "live" ? "Pause" : "Resume"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontFamily: "'Fraunces',serif", fontWeight: 700, color: "#1a1612" }}>{totalApplicants(job)}</div>
              <div style={{ fontSize: 11, color: "#8a7e72" }}>applicants</div>
              <button
                className="btn-ghost"
                style={{ marginTop: 8, fontSize: 12 }}
                onClick={() => {
                  setSelectedJob(job.id);
                  setPanel("applicants");
                }}
              >
                View &rarr;
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
