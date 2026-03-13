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
          {panel === "dashboard" && <Dashboard />}
          {panel === "post" && <PostJob />}
          {panel === "jobs" && <AllJobs />}
          {panel === "applicants" && <Applicants />}
          {panel === "questionnaire" && <Questionnaire />}
          {panel === "report" && <ResumeReport />}
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
