import { supabaseUrl, supabaseAnon } from "../supabaseClient.js";

/**
 * Enhance a job description using AI (via Supabase Edge Function).
 * Returns: { jd, skills, linkedinJD, indeedJD, jobhaiJD, apnaJD }
 */
export async function enhanceJD({ title, dept, location, type, exp, salary, extraNotes, jdInput }) {
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.");
  }
  const url = `${supabaseUrl}/functions/v1/enhance-jd`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnon}`,
    },
    body: JSON.stringify({ title, dept, location, type, exp, salary, extraNotes, jdInput }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "JD enhancement failed");
  return data;
}

/**
 * Generate interview questionnaire using AI (via Supabase Edge Function, OpenAI).
 * Returns: { sections: [{ title, questions: [{ question, purpose, expectedAnswer }] }] }
 * jdText: optional JD text (from paste or uploaded PDF/DOCX) to tailor questions.
 */
export async function generateQuestionnaire({ jobId, interviewType, customTopics, jdText }) {
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("Supabase not configured.");
  }
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/generate-questionnaire`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnon}`,
    },
    body: JSON.stringify({
      job_id: jobId,
      interview_type: interviewType,
      custom_topics: customTopics || undefined,
      jd_text: jdText?.trim() || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Questionnaire generation failed");
  return data;
}
