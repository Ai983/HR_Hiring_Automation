import "./styles/global.css";
import { useEffect } from "react";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import Login from "./components/auth/Login.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import Toast from "./components/layout/Toast.jsx";
import Dashboard from "./components/panels/Dashboard.jsx";
import PostJob from "./components/panels/PostJob.jsx";
import AllJobs from "./components/panels/AllJobs.jsx";
import Applicants from "./components/panels/Applicants.jsx";
import Questionnaire from "./components/panels/Questionnaire.jsx";
import ResumeReport from "./components/panels/ResumeReport.jsx";
import TodayAttendance from "./components/panels/TodayAttendance.jsx";
import AttendanceAdmin from "./components/panels/AttendanceAdmin.jsx";
import MonthlyAttendance from "./components/panels/MonthlyAttendance.jsx";
import WeeklyAttendance from "./components/panels/WeeklyAttendance.jsx";
import AttendanceSetup from "./components/panels/AttendanceSetup.jsx";
import LocationTracking from "./components/panels/LocationTracking.jsx";
import GeofenceSites from "./components/panels/GeofenceSites.jsx";
import LeaveRequests from "./components/panels/LeaveRequests.jsx";
import EmployeeManagement from "./components/panels/EmployeeManagement.jsx";
import CallingQueue from "./components/panels/CallingQueue.jsx";
import Interviews from "./components/panels/Interviews.jsx";
import ReferenceCheck from "./components/panels/ReferenceCheck.jsx";
import OfferLetters from "./components/panels/OfferLetters.jsx";
import Onboarding from "./components/panels/Onboarding.jsx";
import Documents from "./components/panels/Documents.jsx";
import SurveyLeads from "./components/panels/SurveyLeads.jsx";
import ApplicantModal from "./components/modals/ApplicantModal.jsx";
import ResumeUploadModal from "./components/modals/ResumeUploadModal.jsx";

// Which module each panel belongs to.
const HIRING = new Set(["dashboard", "post", "jobs", "applicants", "calling", "interviews", "reference", "offers", "onboarding", "documents", "questionnaire", "report", "survey"]);
export const moduleForPanel = (p) => (HIRING.has(p) ? "hireflow" : "attendance");

function Splash({ text }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ef", color: "#8a7e72", fontSize: 14 }}>{text}</div>;
}

function NoAccess({ msg }) {
  const { ctx, logout } = useApp();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ef", padding: 20 }}>
      <div className="card" style={{ maxWidth: 400, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 20, color: "#1a1612", marginBottom: 8 }}>No access</div>
        <p style={{ fontSize: 13, color: "#8a7e72", marginBottom: 18 }}>{msg}</p>
        {ctx && <p style={{ fontSize: 12, color: "#b0a898", marginBottom: 18 }}>Signed in as {ctx.name} ({ctx.email})</p>}
        <button className="btn-outline" onClick={logout} style={{ width: "100%", justifyContent: "center" }}>Sign out</button>
      </div>
    </div>
  );
}

function AppContent() {
  const { panel, setPanel, modal, setModal, authLoading, session, ctx, hasModule } = useApp();

  // Land on a permitted panel when the user has attendance but not hireflow.
  useEffect(() => {
    if (!ctx) return;
    if (!hasModule("hireflow") && hasModule("attendance") && HIRING.has(panel)) setPanel("today");
  }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) return <Splash text="Loading…" />;
  if (!session) return <Login />;
  if (!ctx) return <NoAccess msg="Your login isn't linked to an employee record yet. Contact HR." />;
  if (!hasModule("hireflow") && !hasModule("attendance")) return <NoAccess msg="You don't have access to HireFlow. Ask an admin to grant the hireflow or attendance module." />;

  const allowed = hasModule(moduleForPanel(panel));

  return (
    <>
      <Toast />
      {modal?.type === "applicant" && <ApplicantModal app={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === "resumeUpload" && <ResumeUploadModal initialJobId={modal.data?.jobId} onClose={() => setModal(null)} />}

      <div className="app">
        <Sidebar />
        <main className="main">
          {!allowed ? (
            <div className="fade-in" style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>
              You don't have access to this section.
            </div>
          ) : (
            <>
              {panel === "dashboard"    && <Dashboard />}
              {panel === "post"         && <PostJob />}
              {panel === "jobs"         && <AllJobs />}
              {panel === "applicants"   && <Applicants />}
              {panel === "calling"      && <CallingQueue />}
              {panel === "interviews"   && <Interviews />}
              {panel === "reference"    && <ReferenceCheck />}
              {panel === "offers"       && <OfferLetters />}
              {panel === "onboarding"   && <Onboarding />}
              {panel === "documents"    && <Documents />}
              {panel === "questionnaire"&& <Questionnaire />}
              {panel === "report"       && <ResumeReport />}
              {panel === "survey"        && <SurveyLeads />}
              {panel === "today"        && <TodayAttendance />}
              {panel === "attendance"   && <AttendanceAdmin />}
              {panel === "weekly"       && <WeeklyAttendance />}
              {panel === "monthly"      && <MonthlyAttendance />}
              {panel === "attsetup"     && <AttendanceSetup />}
              {panel === "location"     && <LocationTracking />}
              {panel === "geofence"     && <GeofenceSites />}
              {panel === "leave"        && <LeaveRequests />}
              {panel === "employees"    && <EmployeeManagement />}
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
