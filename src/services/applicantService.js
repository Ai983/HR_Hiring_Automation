import { supabase, supabaseUrl, supabaseAnon } from "../supabaseClient.js";
import { dbApplicantToApp } from "../mappers.js";

export async function fetchApplicants() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("applicants")
    .select("*")
    .order("applied_at", { ascending: false });
  return (data || []).map(dbApplicantToApp);
}

export async function createApplicant(fields) {
  if (!supabase) throw new Error("Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and restart the dev server.");
  const { data, error } = await supabase
    .from("applicants")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw new Error(error.message || "Could not save applicant.");
  return dbApplicantToApp(data);
}

export async function updateApplicantStage(id, stage) {
  if (!supabase) return;
  await supabase.from("applicants").update({ stage }).eq("id", id);
}

export async function uploadResumeFile(path, file) {
  if (!supabase) throw new Error("Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and restart the dev server.");
  const { error } = await supabase.storage.from("resumes").upload(path, file, { upsert: false });
  if (error) throw new Error(error.message || "Storage upload failed.");
}

export async function screenApplicant(appId) {
  if (!supabaseUrl || !supabaseAnon) throw new Error("Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and restart the dev server.");
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/screen-resume`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnon}`,
      },
      body: JSON.stringify({ applicant_id: appId }),
    });
  } catch (e) {
    const msg = e && e.message === "Failed to fetch"
      ? "Network error. Check .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), restart dev server, and ensure the screen-resume Edge Function is deployed."
      : (e?.message || "Screening request failed.");
    throw new Error(msg);
  }
  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error("Invalid response from screening service. Ensure the screen-resume Edge Function is deployed.");
  }
  if (!res.ok) {
    const errMsg = data.error || "Screening failed";
    const hint = /invalid api key|invalid_api_key/i.test(errMsg)
      ? " Set OPEN_API in Supabase Dashboard → Project Settings → Edge Functions → Secrets to your OpenAI key (platform.openai.com/api-keys)."
      : "";
    throw new Error(errMsg + hint);
  }
  return data;
}

export async function deleteAllApplicants() {
  if (!supabase) return;
  const zero = "00000000-0000-0000-0000-000000000000";
  await supabase.from("applicants").delete().or(`id.eq.${zero},id.neq.${zero}`);
}
