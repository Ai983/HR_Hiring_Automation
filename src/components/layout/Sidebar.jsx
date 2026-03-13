import { useApp } from "../../context/AppContext.jsx";
import { PORTALS } from "../../constants.js";
import { supabase } from "../../supabaseClient.js";
import { deleteAllJobs } from "../../services/jobService.js";
import { deleteAllApplicants } from "../../services/applicantService.js";

export default function Sidebar() {
  const { panel, setPanel, jobs, applicants, setJobs, setApplicants, setSelectedJob, setModal, showToast } = useApp();

  const liveJobs = jobs.filter((j) => PORTALS.some((p) => j[p.id]?.status === "live")).length;
  const newApps = applicants.filter((a) => a.stage === "new").length;

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
    { id: "dashboard",     icon: "\u2B1B", label: "Dashboard" },
    { id: "post",          icon: "\u2726", label: "Post a Job" },
    { id: "jobs",          icon: "\u2261", label: "All Jobs",        badge: liveJobs },
    { id: "applicants",    icon: "\u25CE", label: "Applicants",      badge: newApps },
    { id: "questionnaire", icon: "\u2753", label: "Questionnaire" },
    { id: "report",        icon: "\u2630", label: "Resume Report" },
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
        {navItems.map((item) => (
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
        ))}
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
