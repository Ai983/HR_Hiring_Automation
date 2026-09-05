import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS } from "../../constants.js";
import { supabase } from "../../supabaseClient.js";
import { fetchSurveyNewCount } from "../../services/surveyService.js";
import { fetchPendingLeaveCount } from "../../services/leaveService.js";
import { fetchTodaySubmittedCount } from "../../services/assessmentService.js";
import { buildNav, visibleGroups } from "../../navigation.js";
import SyncStatus from "./SyncStatus.jsx";

export default function Sidebar() {
  const { panel, setPanel, jobs, applicants, setSelectedJob, setPolicyCategory, ctx, hasModule, logout } = useApp();
  const canRegularize = !!ctx?.is_super_admin;
  const [surveyCount, setSurveyCount] = useState(0);
  const [leaveCount, setLeaveCount]   = useState(0);
  const [assessCount, setAssessCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      fetchSurveyNewCount().then(setSurveyCount);
      fetchPendingLeaveCount().then(setLeaveCount);
      fetchTodaySubmittedCount().then(setAssessCount).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, []);

  const liveJobs    = jobs.filter((j) => PORTALS.some((p) => j[p.id]?.status === "live")).length;
  const newApps     = applicants.filter((a) => a.stage === "new").length;
  const callingQ    = applicants.filter((a) => a.stage === "screening" && a.shortlisted).length
                    + applicants.filter((a) => a.stage === "calling").length;
  const interviews  = applicants.filter((a) => a.stage === "interview").length;
  const references  = applicants.filter((a) => a.stage === "reference").length;
  const offers      = applicants.filter((a) => a.stage === "offer").length;
  const onboardings = applicants.filter((a) => a.stage === "hired" || a.stage === "onboarding").length;

  const topItem = { id: "dashboard", icon: "⬛", label: "Dashboard" };

  // Single source of truth, shared with the dashboard — see navigation.js.
  const groups = visibleGroups(
    buildNav({
      canRegularize,
      badges: {
        jobs: liveJobs, applicants: newApps, survey: surveyCount,
        assessment: assessCount, calling: callingQ, interviews,
        reference: references, offers, onboarding: onboardings,
        leave: leaveCount,
      },
    }),
    hasModule
  );

  const groupForPanel = (p) =>
    groups.find((g) => g.items.some((it) => it.panel === p))?.id ?? null;

  const [openGroup, setOpenGroup] = useState(groupForPanel(panel) ?? "grp-hire");

  useEffect(() => {
    const g = groupForPanel(panel);
    if (g) setOpenGroup(g);
  }, [panel]);

  const goTo = (item) => {
    // `item` is either a nav entry or the bare dashboard item. Policy entries
    // all open the same panel and differ only by which section they land on.
    const target = typeof item === "string" ? { panel: item } : item;
    if (target.category) setPolicyCategory(target.category);
    setPanel(target.panel);
    if (target.panel !== "applicants") setSelectedJob(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">H</div>
          <span className="logo-text">HireFlow</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${panel === topItem.id ? "active" : ""}`}
          onClick={() => goTo(topItem.id)}
        >
          <span className="nav-icon">{topItem.icon}</span>
          {topItem.label}
        </button>

        {groups.map((group) => {
          const open = openGroup === group.id;
          return (
            <div key={group.id} className="nav-group">
              <button
                className={`nav-group-header ${open ? "open" : ""}`}
                onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
                aria-expanded={open}
              >
                <span className="nav-icon">{group.icon}</span>
                <span className="nav-group-label">{group.label}</span>
                <span className="nav-chevron">{open ? "▾" : "▸"}</span>
              </button>
              {open && (
                <div className="nav-group-items">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className={`nav-item ${panel === item.panel ? "active" : ""}`}
                      onClick={() => goTo(item)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                      {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <SyncStatus />
        <div className="user-pill">
          <div className="user-avatar">{(ctx?.name || "?").slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div className="user-name">{ctx?.name || "—"}</div>
            <div className="user-role" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ctx?.email || ""}</div>
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={logout}
          style={{ marginTop: 8, width: "100%", justifyContent: "center", fontSize: 12, color: "#8a7e72" }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
