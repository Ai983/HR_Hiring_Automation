import { supabase } from "../supabaseClient.js";

export async function fetchSurveyResponses(filters = {}) {
  if (!supabase) return [];
  let query = supabase
    .from("survey_responses")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.source) query = query.eq("source", filters.source);
  if (filters.recommendation) query = query.eq("ai_recommendation", filters.recommendation);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.form_name) query = query.eq("form_name", filters.form_name);

  const { data } = await query.limit(200);
  return data || [];
}

export async function fetchSurveyNewCount() {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("survey_responses")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");
  return count || 0;
}

export async function convertToApplicant(surveyId, jobId) {
  if (!supabase) return null;

  const { data: survey } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("id", surveyId)
    .single();

  if (!survey) throw new Error("Survey not found");

  const { data: applicant, error } = await supabase
    .from("applicants")
    .insert({
      job_id: jobId,
      full_name: survey.full_name,
      email: survey.email,
      phone: survey.phone,
      portal: survey.source,
      stage: "calling",
      ai_score: survey.ai_score,
      shortlisted: survey.ai_recommendation === "strong_recommend",
      screening_notes: survey.ai_one_line,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from("survey_responses")
    .update({ applicant_id: applicant.id, status: "converted" })
    .eq("id", surveyId);

  return applicant;
}

export async function rejectSurveyLead(surveyId) {
  if (!supabase) return;
  await supabase.from("survey_responses").update({ status: "rejected" }).eq("id", surveyId);
}
