import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS, STAGES, STAGE_META, STATUS_META } from "../../constants.js";
import { totalApplicants, totalViews } from "../../helpers.js";
import { buildNav, visibleGroups } from "../../navigation.js";
import NavMenu from "../layout/NavMenu.jsx";

// ─────────────────────────────────────────────────────────────────────
// The dashboard is the front door. There is no sidebar: navigation is four
// section buttons, each opening a dropdown of the pages inside it.
//
// The page lists are NOT written out here. They come from navigation.js —
// the same definition the top bar renders — so the two cannot drift.
// ─────────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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
    jobs, applicants, setPanel, setSelectedJob,
    ctx, hasModule, navBadges,
  } = useApp();

  const [openId, setOpenId] = useState(null); // only one dropdown open at a time

  const liveJobs   = jobs.filter((j) => PORTALS.some((p) => j[p.id]?.status === "live")).length;
  const totalApps  = applicants.length;
  const hiredCount = applicants.filter((a) => a.stage === "hired").length;
  const totalJobViews = jobs.reduce((a, j) => a + totalViews(j), 0);

  const groups = visibleGroups(
    buildNav({ badges: navBadges, canRegularize: !!ctx?.is_super_admin }),
    hasModule
  );
  const firstName = (ctx?.name || "").trim().split(/\s+/)[0] || "HR";

  return (
    <div className="fade-in">
      <div className="page-title">{greeting()}, {firstName}</div>
      <div className="page-sub">Pick a section — every page is in here.</div>

      {/* ── The four section buttons. Each opens a dropdown of its pages. ── */}
      <div className="dash-sections">
        {groups.map((g) => (
          <NavMenu
            key={g.id}
            group={g}
            variant="hero"
            open={openId === g.id}
            onToggle={() => setOpenId((prev) => (prev === g.id ? null : g.id))}
            onClose={() => setOpenId(null)}
          />
        ))}
      </div>

      <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 12 }}>
        {ctx?.is_hr_admin
          ? "HR Policy: you can upload and archive documents — everyone signed in can read them."
          : "HR Policy: published by HR. Open a section to read or download the current document."}
      </div>

      {/* Hiring snapshot — only meaningful with the hireflow module. */}
      {hasModule("hireflow") && (
        <div className="stat-row" style={{ marginTop: 26 }}>
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
