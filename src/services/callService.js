import { supabase } from "../supabaseClient.js";

export async function fetchCallQueue() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("applicants")
    .select("*, jobs(title, jd), call_logs(id, call_status, call_date)")
    .in("stage", ["calling"])
    .order("call_date", { referencedTable: "call_logs", ascending: false })
    .order("ai_score", { ascending: false });
  return data || [];
}

export async function fetchCallLogs(applicantId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from("call_logs")
    .select("*")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function fetchDueCallbacks() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("call_logs")
    .select("*, applicants(full_name, phone, job_id)")
    .eq("call_status", "callback_requested")
    .lte("callback_time", new Date().toISOString());
  return data || [];
}

export async function createCallLog({ applicant_id, called_by, call_status, call_notes, callback_time }) {
  const { data, error } = await supabase
    .from("call_logs")
    .insert({ applicant_id, called_by, call_status, call_notes, callback_time: callback_time || null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function countCallAttempts(applicantId) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("call_logs")
    .select("*", { count: "exact", head: true })
    .eq("applicant_id", applicantId);
  return count || 0;
}
