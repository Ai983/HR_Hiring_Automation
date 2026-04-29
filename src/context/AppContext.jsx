import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { SEED_JOBS, SEED_APPLICANTS } from "../constants.js";
import { useToast } from "../hooks/useToast.js";
import { fetchJobs } from "../services/jobService.js";
import { fetchApplicants } from "../services/applicantService.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [panel, setPanel] = useState("dashboard");
  const [selectedJob, setSelectedJob] = useState(null);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(!!supabase);
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (!supabase) {
      setJobs(SEED_JOBS);
      setApplicants(SEED_APPLICANTS);
      return;
    }
    (async () => {
      const [loadedJobs, loadedApps] = await Promise.all([fetchJobs(), fetchApplicants()]);
      setJobs(loadedJobs);
      setApplicants(loadedApps);
      setLoading(false);
    })();
  }, []);

  const refreshApplicants = useCallback(async () => {
    if (!supabase) return;
    const apps = await fetchApplicants();
    setApplicants(apps);
  }, []);

  const value = {
    jobs, setJobs,
    applicants, setApplicants,
    refreshApplicants,
    panel, setPanel,
    selectedJob, setSelectedJob,
    modal, setModal,
    loading,
    toast, showToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
