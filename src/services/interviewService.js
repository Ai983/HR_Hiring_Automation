import { supabase } from "../supabaseClient.js";

export async function fetchInterviews() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("interviews")
    .select("*, applicants(full_name, email, phone, job_id, jobs(title))")
    .order("scheduled_at", { ascending: true });
  return data || [];
}

export async function fetchInterviewsForApplicant(applicantId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from("interviews")
    .select("*")
    .eq("applicant_id", applicantId)
    .order("scheduled_at", { ascending: false });
  return data || [];
}

export async function createInterview({ applicant_id, interview_type, scheduled_at, duration_minutes, mode, meet_link, panel, venue }) {
  const { data, error } = await supabase
    .from("interviews")
    .insert({ applicant_id, interview_type, scheduled_at, duration_minutes: duration_minutes || 60, mode, meet_link, panel, venue })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateInterview(id, fields) {
  const { data, error } = await supabase
    .from("interviews")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function submitFeedback(interviewId, feedback) {
  const { data, error } = await supabase
    .from("interviews")
    .update({ feedback, status: "completed" })
    .eq("id", interviewId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
