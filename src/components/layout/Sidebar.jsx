import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS } from "../../constants.js";
import { supabase } from "../../supabaseClient.js";
import { fetchSurveyNewCount } from "../../services/surveyService.js";
import { fetchPendingLeaveCount } from "../../services/leaveService.js";
import SyncStatus from "./SyncStatus.jsx";

export default function Sidebar() {
  const { panel, setPanel, jobs, applicants, setSelectedJob, ctx, hasModule, logout } = useApp();
  const [surveyCount, setSurveyCount] = useState(0);
  const [leaveCount, setLeaveCount]   = useState(0);

  useEffect(() => {
    fetchSurveyNewCount().then(setSurveyCount);
    fetchPendingLeaveCount().then(setLeaveCount);
    const interval = setInterval(() => {
      fetchSurveyNewCount().then(setSurveyCount);
      fetchPendingLeaveCount().then(setLeaveCount);
    }, 60000);
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

  const groups = [
    {
      id: "grp-onboarding",
      icon: "\u{1F9ED}",
      label: "Onboarding",
      items: [
        { id: "post",          icon: "✦", label: "Post a Job" },
        { id: "jobs",          icon: "≡", label: "All Jobs",        badge: liveJobs },
        { id: "applicants",    icon: "◎", label: "Applicants",      badge: newApps },
        { id: "survey",        icon: "📋", label: "Survey Leads",    badge: surveyCount },
        { id: "calling",       icon: "☎", label: "Calling Queue",   badge: callingQ },
        { id: "interviews",    icon: "\u{1F4C5}", label: "Interviews",    badge: interviews },
        { id: "reference",     icon: "✅", label: "Reference Check", badge: references },
        { id: "offers",        icon: "\u{1F4DD}", label: "Offer Letters", badge: offers },
        { id: "onboarding",    icon: "\u{1F3E0}", label: "Onboarding",    badge: onboardings },
        { id: "documents",     icon: "\u{1F4C4}", label: "Documents" },
        { id: "questionnaire", icon: "❓", label: "Questionnaire" },
        { id: "report",        icon: "☰", label: "Resume Report" },
      ],
    },
    {
      id: "grp-employees",
      icon: "\u{1F465}",
      label: "Employee Management",
      items: [
        { id: "attendance",    icon: "⏰", label: "Attendance" },
        { id: "weekly",        icon: "\u{1F5D3}", label: "Weekly Report" },
        { id: "monthly",       icon: "\u{1F4CA}", label: "Monthly Report" },
        { id: "attsetup",      icon: "⚙", label: "Attendance Setup" },
        { id: "location",      icon: "\u{1F4CD}", label: "Location Tracking" },
        { id: "geofence",      icon: "\u{1F5FA}", label: "Geofence Sites" },
        { id: "leave",         icon: "\u{1F334}", label: "Leave Requests", badge: leaveCount },
        { id: "employees",     icon: "▦", label: "Employees" },
      ],
    },
  ];

  const groupForPanel = (p) =>
    groups.find((g) => g.items.some((it) => it.id === p))?.id ?? null;

  const [openGroup, setOpenGroup] = useState(groupForPanel(panel) ?? "grp-onboarding");

  useEffect(() => {
    const g = groupForPanel(panel);
    if (g) setOpenGroup(g);
  }, [panel]);

  const goTo = (id) => {
    setPanel(id);
    if (id !== "applicants") setSelectedJob(null);
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
        {hasModule("hireflow") && (
          <button
            className={`nav-item ${panel === topItem.id ? "active" : ""}`}
            onClick={() => goTo(topItem.id)}
          >
            <span className="nav-icon">{topItem.icon}</span>
            {topItem.label}
          </button>
        )}

        {groups.filter((group) => hasModule(group.id === "grp-onboarding" ? "hireflow" : "attendance")).map((group) => {
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
                      className={`nav-item ${panel === item.id ? "active" : ""}`}
                      onClick={() => goTo(item.id)}
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
