import { supabase } from "../supabaseClient.js";
import { PORTALS } from "../constants.js";
import { dbJobToApp, appJobToDb } from "../mappers.js";

export async function fetchJobs() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []).map(dbJobToApp);
}

export async function createJob(job, jdResult, selPortals) {
  const dbRow = appJobToDb(job, jdResult, selPortals);
  if (!supabase) return { ...job, id: crypto.randomUUID() };
  const { data: inserted, error } = await supabase
    .from("jobs")
    .insert(dbRow)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return dbJobToApp(inserted);
}

export async function updatePortalStatus(jobId, portalStatus) {
  if (!supabase) return;
  await supabase.from("jobs").update({ portal_status: portalStatus }).eq("id", jobId);
}


/** Find job id by title, or create a new job with that title (and optional jd). Returns id. */
export async function resolveJobIdForRole(jobs, title, jdText, setJobs) {
  const existing = jobs.find((j) => j.title === title);
  if (existing) return existing.id;
  if (!supabase) return null;
  const portal_status = {};
  PORTALS.forEach((p) => {
    portal_status[p.id] = { status: "draft", applicants: 0, views: 0 };
  });
  const dbRow = {
    title,
    dept: "General",
    location: "",
    type: "Full-time",
    exp: "",
    salary: "",
    jd: jdText?.trim() || null,
    skills: [],
    portal_status,
    posted_date: new Date().toISOString().split("T")[0],
  };
  const { data: inserted, error } = await supabase.from("jobs").insert(dbRow).select("*").single();
  if (error) throw new Error(error.message);
  const appJob = dbJobToApp(inserted);
  if (setJobs) setJobs((prev) => [appJob, ...prev]);
  return inserted.id;
}
