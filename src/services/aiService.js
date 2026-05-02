import { supabaseUrl, supabaseAnon } from "../supabaseClient.js";

async function callEdgeFunction(name, body) {
  if (!supabaseUrl || !supabaseAnon) throw new Error("Supabase not configured.");
  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseAnon}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${name} failed`);
  return data;
}

export async function enhanceJD({ title, dept, location, type, exp, salary, extraNotes, jdInput }) {
  return callEdgeFunction("enhance-jd", { title, dept, location, type, exp, salary, extraNotes, jdInput });
}

export async function generateQuestionnaire({ jobId, interviewType, customTopics, jdText }) {
  return callEdgeFunction("generate-questionnaire", {
    job_id: jobId,
    interview_type: interviewType,
    custom_topics: customTopics || undefined,
    jd_text: jdText?.trim() || undefined,
  });
}

export async function generateCallPrep(applicantId) {
  return callEdgeFunction("call-prep", { applicant_id: applicantId });
}

export async function synthesizeFeedback(interviewId) {
  return callEdgeFunction("synthesize-feedback", { interview_id: interviewId });
}

export async function summarizeReference(applicantId) {
  return callEdgeFunction("summarize-reference", { applicant_id: applicantId });
}

export async function generateOfferLetter(offerData) {
  return callEdgeFunction("generate-offer-letter", offerData);
}
