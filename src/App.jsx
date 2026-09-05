import "./styles/global.css";
import { useEffect } from "react";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import Login from "./components/auth/Login.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import Toast from "./components/layout/Toast.jsx";
import Dashboard from "./components/panels/Dashboard.jsx";
import AllJobs from "./components/panels/AllJobs.jsx";
import Applicants from "./components/panels/Applicants.jsx";
import Questionnaire from "./components/panels/Questionnaire.jsx";
import ResumeReport from "./components/panels/ResumeReport.jsx";
import TodayAttendance from "./components/panels/TodayAttendance.jsx";
import AttendanceAdmin from "./components/panels/AttendanceAdmin.jsx";
import MonthlyAttendance from "./components/panels/MonthlyAttendance.jsx";
import OfficeTeamAttendance from "./components/panels/OfficeTeamAttendance.jsx";
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
import AssessmentResults from "./components/panels/AssessmentResults.jsx";
import QuestionBank from "./components/panels/QuestionBank.jsx";
import AttendanceRegularize from "./components/panels/AttendanceRegularize.jsx";
import Policies from "./components/panels/Policies.jsx";
import Performance from "./components/panels/Performance.jsx";
import ApplicantModal from "./components/modals/ApplicantModal.jsx";
import ResumeUploadModal from "./components/modals/ResumeUploadModal.jsx";

// Panels that belong to no single module — anyone with a Hub login and any
// module at all may open them.
//
//   dashboard   — it is the front door and now carries the Employee
//                 Management and HR Policy sections too. Gating it on
//                 `hireflow` (as it was) meant an attendance-only employee
//                 landed on "You don't have access to this section" at the
//                 one URL everybody opens first.
//   policies    — company policy is company-wide by definition. A policy
//                 only the hiring team can read is not published.
//   performance — RLS returns an employee only their own review, so the
//                 panel is safe to open for everyone; HR sees the cycles.
const COMMON = new Set(["dashboard", "policies", "performance"]);

// Which module each of the rest belongs to.
const HIRING = new Set(["jobs", "applicants", "calling", "interviews", "reference", "offers", "onboarding", "documents", "questionnaire", "report", "survey", "assessment", "questionbank"]);
export const moduleForPanel = (p) => (HIRING.has(p) ? "hireflow" : "attendance");

// Panels only a super_admin may open at all — not even read-only.
//
// The sidebar already hides these, but hiding a nav item is not access control:
// `panel` is also settable from the URL (?panel=regularize), which is how the
// EA reached Attendance Corrections and read every correction ever made, on a
// page that then told her she was not allowed to use it.
//
// NOTE: the matching RLS on hr.attendance_regularization stays deliberately at
// `is_hr_admin() OR own rows` and must NOT be narrowed to super_admin.
// hr.attendance_day is security_invoker and LEFT JOINs that table, so an EA who
// could not read it would see every regularized day silently revert to its raw
// punch values — twelve of Aniket's corrected days would read 'absent' again in
// her own Office Team report. The data must stay readable for the reports to be
// right; it is the CORRECTIONS SCREEN that is super-admin-only.
const SUPER_ONLY = new Set(["regularize"]);

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

  const allowed = (COMMON.has(panel) || hasModule(moduleForPanel(panel)))
    && (!SUPER_ONLY.has(panel) || !!ctx.is_super_admin);

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
              {panel === "assessment"   && <AssessmentResults />}
              {panel === "questionbank" && <QuestionBank />}
              {panel === "today"        && <TodayAttendance />}
              {panel === "attendance"   && <AttendanceAdmin />}
              {panel === "weekly"       && <WeeklyAttendance />}
              {panel === "monthly"      && <MonthlyAttendance />}
              {panel === "officeteam"   && <OfficeTeamAttendance />}
              {panel === "attsetup"     && <AttendanceSetup />}
              {panel === "location"     && <LocationTracking />}
              {panel === "geofence"     && <GeofenceSites />}
              {panel === "leave"        && <LeaveRequests />}
              {panel === "regularize"   && <AttendanceRegularize />}
              {panel === "employees"    && <EmployeeManagement />}
              {panel === "policies"     && <Policies />}
              {panel === "performance"  && <Performance />}
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
