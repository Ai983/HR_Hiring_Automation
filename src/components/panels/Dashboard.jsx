import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS, STAGES, STAGE_META, STATUS_META } from "../../constants.js";
import { totalApplicants, totalViews } from "../../helpers.js";
import { buildNav, visibleGroups } from "../../navigation.js";
import { fetchSurveyNewCount } from "../../services/surveyService.js";
import { fetchPendingLeaveCount } from "../../services/leaveService.js";
import { fetchTodaySubmittedCount } from "../../services/assessmentService.js";

// ─────────────────────────────────────────────────────────────────────
// The dashboard is the front door: every page in the sidebar is one click
// away from here, grouped the way HR thinks about the work — Hire, Employee
// Management, Performance, HR Policy.
//
// The tile list is NOT written out here. It comes from navigation.js, the
// same definition the sidebar renders, so the two cannot drift.
// ─────────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** One clickable page tile. */
function NavTile({ item, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "13px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left",
        background: "#fff",
        border: `1.5px solid ${hover ? "#c97a2a" : "#e8e2d9"}`,
        boxShadow: hover ? "0 4px 14px rgba(201,122,42,0.10)" : "none",
        transform: hover ? "translateY(-1px)" : "none",
        transition: "all 0.15s",
        fontFamily: "'Nunito',sans-serif",
      }}
    >
      <span style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: hover ? "rgba(201,122,42,0.12)" : "#faf8f5",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, transition: "background 0.15s",
      }}>
        {item.icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: "#1a1612" }}>
        {item.label}
      </span>
      {item.badge > 0 && (
        <span style={{
          background: "#c97a2a", color: "#fff", borderRadius: 20,
          padding: "2px 8px", fontSize: 11, fontWeight: 800, flexShrink: 0,
        }}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

function SectionHeader({ icon, label, blurb }) {
  return (
    <div style={{ marginBottom: 12, marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18, color: "#1a1612" }}>
          {label}
        </span>
      </div>
      {blurb && <div style={{ fontSize: 12.5, color: "#8a7e72", marginTop: 3 }}>{blurb}</div>}
    </div>
  );
}

export default function Dashboard() {
  const {
    jobs, applicants, setPanel, setSelectedJob, setPolicyCategory,
    ctx, hasModule,
  } = useApp();

  // Badge counts. The sidebar polls these on a timer; here a single fetch on
  // mount is right — you are looking at the dashboard for seconds, not
  // leaving it open all day, and a second poller doubles the query load for
  // numbers nobody watches change.
  const [counts, setCounts] = useState({ survey: 0, leave: 0, assessment: 0 });
  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchSurveyNewCount(), fetchPendingLeaveCount(), fetchTodaySubmittedCount()])
      .then(([s, l, a]) => {
        if (!alive) return;
        setCounts({
          survey:     s.status === "fulfilled" ? s.value : 0,
          leave:      l.status === "fulfilled" ? l.value : 0,
          assessment: a.status === "fulfilled" ? a.value : 0,
        });
      });
    return () => { alive = false; };
  }, []);

  const liveJobs   = jobs.filter((j) => PORTALS.some((p) => j[p.id]?.status === "live")).length;
  const totalApps  = applicants.length;
  const hiredCount = applicants.filter((a) => a.stage === "hired").length;
  const totalJobViews = jobs.reduce((a, j) => a + totalViews(j), 0);

  const nav = buildNav({
    canRegularize: !!ctx?.is_super_admin,
    badges: {
      jobs:       liveJobs,
      applicants: applicants.filter((a) => a.stage === "new").length,
      survey:     counts.survey,
      assessment: counts.assessment,
      leave:      counts.leave,
      calling:    applicants.filter((a) => a.stage === "screening" && a.shortlisted).length
                + applicants.filter((a) => a.stage === "calling").length,
      interviews: applicants.filter((a) => a.stage === "interview").length,
      reference:  applicants.filter((a) => a.stage === "reference").length,
      offers:     applicants.filter((a) => a.stage === "offer").length,
      onboarding: applicants.filter((a) => a.stage === "hired" || a.stage === "onboarding").length,
    },
  });

  const go = (item) => {
    if (item.category) setPolicyCategory(item.category);
    if (item.panel !== "applicants") setSelectedJob(null);
    setPanel(item.panel);
  };

  const groups = visibleGroups(nav, hasModule);
  const firstName = (ctx?.name || "").trim().split(/\s+/)[0] || "HR";

  return (
    <div className="fade-in">
      <div className="page-title">{greeting()}, {firstName}</div>
      <div className="page-sub">Everything you run, one click away.</div>

      {/* Hiring snapshot — only meaningful with the hireflow module. */}
      {hasModule("hireflow") && (
        <div className="stat-row" style={{ marginTop: 18 }}>
          {[
            { cls: "s1", val: liveJobs,      lbl: "Active Postings" },
            { cls: "s2", val: totalApps,     lbl: "Total Applicants" },
            { cls: "s3", val: hiredCount,    lbl: "Hired This Month" },
            { cls: "s4", val: totalJobViews, lbl: "Total Job Views" },
          ].map((s) => (
            <div key={s.lbl} className={`stat-card ${s.cls}`}>
              <div className="stat-val">{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Section tiles: every page, grouped ── */}
      {groups.map((g) => (
        <div key={g.id}>
          <SectionHeader icon={g.icon} label={g.label} blurb={g.blurb} />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 10,
          }}>
            {g.items.map((item) => (
              <NavTile key={item.id} item={item} onClick={() => go(item)} />
            ))}
          </div>

          {/* HR Policy gets a line of context: it is the one section where
              what people need to know is "who can change this", not a count. */}
          {g.id === "grp-policy" && (
            <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 10 }}>
              {ctx?.is_hr_admin
                ? "You can upload and archive policy documents. Everyone signed in can read them."
                : "Published by HR. Open a section to read or download the current document."}
            </div>
          )}
        </div>
      ))}

      {/* ── Hiring detail, kept below the navigation ── */}
      {hasModule("hireflow") && (
        <>
          {/* Braces, not a quoted string: in JSX "\u{1F4CB}" is the literal
              backslash-u text, not the emoji. */}
          <SectionHeader icon={"\u{1F4CB}"} label="Hiring snapshot" blurb="Where things stand right now." />
          <div className="two-col">
            <div>
              <div className="section-title">Recent Postings</div>
              {jobs.length === 0 && (
                <div className="card" style={{ padding: 24, fontSize: 13, color: "#8a7e72" }}>
                  No jobs yet.
                </div>
              )}
              {jobs.slice(0, 4).map((job) => (
                <div
                  key={job.id}
                  className="job-row"
                  onClick={() => { setSelectedJob(job.id); setPanel("applicants"); }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="job-title">{job.title}</div>
                    <div className="job-meta">
                      {job.dept} &middot; {job.location} &middot; {job.type}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {PORTALS.map(
                      (p) =>
                        job[p.id] && (
                          <span
                            key={p.id}
                            className="tag"
                            style={{
                              background: STATUS_META[job[p.id].status].bg,
                              color: STATUS_META[job[p.id].status].color,
                            }}
                          >
                            {p.label.slice(0, 2)} {job[p.id].status}
                          </span>
                        )
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#8a7e72", minWidth: 80, textAlign: "right" }}>
                    {totalApplicants(job)} applicants
                  </div>
                </div>
              ))}
              <button className="btn-ghost" style={{ marginTop: 6 }} onClick={() => setPanel("jobs")}>
                View all jobs &rarr;
              </button>
            </div>

            <div>
              <div className="section-title">Applicant Pipeline</div>
              <div className="card" style={{ padding: 18 }}>
                {STAGES.filter((s) => s !== "rejected").map((s) => {
                  const count = applicants.filter((a) => a.stage === s).length;
                  const pct = Math.round((count / Math.max(totalApps, 1)) * 100);
                  return (
                    <div key={s} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                        <span style={{ color: STAGE_META[s].color }}>{STAGE_META[s].label}</span>
                        <span style={{ color: "#8a7e72" }}>{count}</span>
                      </div>
                      <div style={{ height: 6, background: "#f0ece5", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`, background: STAGE_META[s].color,
                          borderRadius: 4, transition: "width 0.5s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card" style={{ padding: 18, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1612", marginBottom: 14 }}>Portal Performance</div>
                {PORTALS.map((p) => {
                  const liveCount = jobs.filter((j) => j[p.id]?.status === "live").length;
                  const appCount = applicants.filter((a) => a.portal === p.id).length;
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0ece5" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: p.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13, color: p.color,
                      }}>
                        {p.label[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1612" }}>{p.label}</div>
                        <div style={{ fontSize: 11, color: "#8a7e72" }}>
                          {liveCount} live &middot; {appCount} applicants
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
