import { supabase } from "../supabaseClient.js";

export async function fetchJoinings() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("joinings")
    .select("*, applicants(full_name, email, phone, job_id, jobs(title)), offers(ctc_gross_annual, ctc_breakup)")
    .not("status", "eq", "confirmed")
    .order("joining_date", { ascending: true });
  return data || [];
}

export async function createJoining(fields) {
  const { data, error } = await supabase
    .from("joinings")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateJoining(id, fields) {
  const { data, error } = await supabase
    .from("joinings")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchProbationsDue() {
  if (!supabase) return [];
  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const { data } = await supabase
    .from("joinings")
    .select("*, applicants(full_name, email)")
    .lte("probation_end_date", in30.toISOString().split("T")[0])
    .gte("probation_end_date", today.toISOString().split("T")[0])
    .eq("status", "probation_active");
  return data || [];
}
