import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { SEED_JOBS, SEED_APPLICANTS } from "../constants.js";
import { useToast } from "../hooks/useToast.js";
import { fetchJobs } from "../services/jobService.js";
import { fetchApplicants } from "../services/applicantService.js";
import { onAuthChange, fetchContext, signIn, signOut, consumeSsoHandoff } from "../services/authService.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [panel, setPanel] = useState("dashboard");
  const [selectedJob, setSelectedJob] = useState(null);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const { toast, showToast } = useToast();

  // ── Auth (universal Hagerstone Hub login) ──
  const [session, setSession] = useState(null);
  const [ctx, setCtx] = useState(null);            // { employee_id, name, email, role, modules[] }
  const [authLoading, setAuthLoading] = useState(!!supabase);

  const resolve = useCallback(async (sess) => {
    setSession(sess);
    if (sess) {
      try { setCtx(await fetchContext()); } catch { setCtx(null); }
    } else {
      setCtx(null);
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) { setJobs(SEED_JOBS); setApplicants(SEED_APPLICANTS); setAuthLoading(false); return; }
    consumeSsoHandoff(); // adopt a Hub tile hand-off (fires onAuthChange when set)
    // onAuthStateChange fires INITIAL_SESSION immediately with the current session.
    // Defer work out of the callback — calling supabase.* inside it deadlocks the auth lock.
    const unsub = onAuthChange((s) => { setTimeout(() => resolve(s), 0); });
    return unsub;
  }, [resolve]);

  // Load hiring data once authenticated.
  useEffect(() => {
    if (!supabase || !session) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [j, a] = await Promise.all([fetchJobs(), fetchApplicants()]);
        if (alive) { setJobs(j); setApplicants(a); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [session]);

  const refreshApplicants = useCallback(async () => {
    if (!supabase) return;
    setApplicants(await fetchApplicants());
  }, []);

  const login = useCallback(async (email, password) => {
    const { session: s } = await signIn(email, password);
    await resolve(s);
  }, [resolve]);

  const logout = useCallback(async () => {
    await signOut();
    setCtx(null); setSession(null);
    setJobs([]); setApplicants([]);
  }, []);

  const modules = ctx?.modules || [];
  const hasModule = useCallback((m) => modules.includes(m), [modules]);

  const value = {
    jobs, setJobs,
    applicants, setApplicants,
    refreshApplicants,
    panel, setPanel,
    selectedJob, setSelectedJob,
    modal, setModal,
    loading,
    toast, showToast,
    // auth
    session, ctx, modules, hasModule, authLoading, login, logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
