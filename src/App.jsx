import "./styles/global.css";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import Toast from "./components/layout/Toast.jsx";
import Dashboard from "./components/panels/Dashboard.jsx";
import PostJob from "./components/panels/PostJob.jsx";
import AllJobs from "./components/panels/AllJobs.jsx";
import Applicants from "./components/panels/Applicants.jsx";
import Questionnaire from "./components/panels/Questionnaire.jsx";
import ResumeReport from "./components/panels/ResumeReport.jsx";
import AttendanceAdmin from "./components/panels/AttendanceAdmin.jsx";
import EmployeeManagement from "./components/panels/EmployeeManagement.jsx";
import CallingQueue from "./components/panels/CallingQueue.jsx";
import Interviews from "./components/panels/Interviews.jsx";
import ReferenceCheck from "./components/panels/ReferenceCheck.jsx";
import OfferLetters from "./components/panels/OfferLetters.jsx";
import Onboarding from "./components/panels/Onboarding.jsx";
import Documents from "./components/panels/Documents.jsx";
import ApplicantModal from "./components/modals/ApplicantModal.jsx";
import ResumeUploadModal from "./components/modals/ResumeUploadModal.jsx";

function AppContent() {
  const { panel, modal, setModal } = useApp();

  return (
    <>
      <Toast />
      {modal?.type === "applicant" && <ApplicantModal app={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === "resumeUpload" && <ResumeUploadModal initialJobId={modal.data?.jobId} onClose={() => setModal(null)} />}

      <div className="app">
        <Sidebar />
        <main className="main">
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
          {panel === "attendance"   && <AttendanceAdmin />}
          {panel === "employees"    && <EmployeeManagement />}
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
