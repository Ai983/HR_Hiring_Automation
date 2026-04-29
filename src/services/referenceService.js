import { supabase } from "../supabaseClient.js";

export async function fetchReferences(applicantId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from("references")
    .select("*")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function fetchAllPendingReferences() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("references")
    .select("*, applicants(full_name, job_id, jobs(title))")
    .in("reference_status", ["pending", "contacted"])
    .order("created_at", { ascending: false });
  return data || [];
}

export async function createReference(fields) {
  const { data, error } = await supabase
    .from("references")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateReference(id, fields) {
  const { data, error } = await supabase
    .from("references")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
