import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS } from "../../constants.js";
import { supabase } from "../../supabaseClient.js";
import { deleteAllJobs } from "../../services/jobService.js";
import { deleteAllApplicants } from "../../services/applicantService.js";
import { fetchSurveyNewCount } from "../../services/surveyService.js";
import { fetchPendingLeaveCount } from "../../services/leaveService.js";

export default function Sidebar() {
  const { panel, setPanel, jobs, applicants, setJobs, setApplicants, setSelectedJob, setModal, showToast } = useApp();
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

  const clearAllData = async () => {
    if (!window.confirm("Clear all jobs and applicants? This cannot be undone.")) return;
    await deleteAllApplicants();
    await deleteAllJobs();
    setJobs([]);
    setApplicants([]);
    setSelectedJob(null);
    setModal(null);
    showToast("All data cleared. You can test from scratch.");
  };

  const navItems = [
    { id: "dashboard",     icon: "⬛", label: "Dashboard" },
    { id: "post",          icon: "✦", label: "Post a Job" },
    { id: "jobs",          icon: "≡", label: "All Jobs",        badge: liveJobs },
    { id: "applicants",    icon: "◎", label: "Applicants",      badge: newApps },
    { id: "survey",        icon: "📋", label: "Survey Leads",    badge: surveyCount },
    { id: "divider1" },
    { id: "calling",       icon: "☎", label: "Calling Queue",   badge: callingQ },
    { id: "interviews",    icon: "\u{1F4C5}", label: "Interviews",   badge: interviews },
    { id: "reference",     icon: "✅", label: "Reference Check", badge: references },
    { id: "offers",        icon: "\u{1F4DD}", label: "Offer Letters",badge: offers },
    { id: "onboarding",    icon: "\u{1F3E0}", label: "Onboarding",   badge: onboardings },
    { id: "documents",     icon: "\u{1F4C4}", label: "Documents" },
    { id: "divider2" },
    { id: "questionnaire", icon: "❓", label: "Questionnaire" },
    { id: "report",        icon: "☰", label: "Resume Report" },
    { id: "divider3" },
    { id: "attendance",    icon: "⏰", label: "Attendance" },
    { id: "leave",         icon: "\u{1F334}", label: "Leave Requests", badge: leaveCount },
    { id: "employees",     icon: "▦", label: "Employees" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">H</div>
          <span className="logo-text">HireFlow</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) =>
          item.id.startsWith("divider") ? (
            <div key={item.id} style={{ height: 1, background: "#2e2925", margin: "8px 0" }} />
          ) : (
            <button
              key={item.id}
              className={`nav-item ${panel === item.id ? "active" : ""}`}
              onClick={() => {
                setPanel(item.id);
                if (item.id !== "applicants") setSelectedJob(null);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
            </button>
          )
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="user-pill">
          <div className="user-avatar">H</div>
          <div style={{ minWidth: 0 }}>
            <div className="user-name">HR</div>
            <div className="user-role">HireFlow</div>
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={clearAllData}
          style={{ marginTop: 8, width: "100%", justifyContent: "center", fontSize: 11, color: "#8a7e72" }}
          title="Remove all jobs and applicants for testing"
        >
          Clear all data (testing)
        </button>
      </div>
    </aside>
  );
}
