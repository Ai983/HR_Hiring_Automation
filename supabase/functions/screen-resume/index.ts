// HireFlow: AI resume screening using OpenAI
// Uses secret OPEN_API (your OpenAI API key) – set in Edge Function Secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPEN_API") || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured (set OPEN_API or OPENAI_API_KEY secret)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { applicant_id } = await req.json();
    if (!applicant_id) {
      return new Response(
        JSON.stringify({ error: "applicant_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "hr" } });

    const { data: applicant, error: appErr } = await supabase
      .from("applicants")
      .select("id, job_id, full_name, resume_text")
      .eq("id", applicant_id)
      .single();

    if (appErr || !applicant) {
      return new Response(
        JSON.stringify({ error: "Applicant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resumeText = applicant.resume_text?.trim() || "";
    if (!resumeText) {
      return new Response(
        JSON.stringify({ error: "No resume text to screen. Upload a resume and ensure text was extracted." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, title, jd, skills")
      .eq("id", applicant.job_id)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jdText = job.jd?.trim() || "";
    const skills = Array.isArray(job.skills) ? job.skills.join(", ") : "";

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are an HR screening assistant. Compare the candidate's resume with the job description and rate fit.
Respond with ONLY a valid JSON object, no markdown or extra text. Use this exact shape:
{"score": <number 0-100>, "shortlisted": <boolean>, "screening_notes": "<2-4 sentences: fit summary, key strengths, and clear recommendation: RECOMMEND HIRE / RECOMMEND REJECT / BORDERLINE - suggest interview>"}`;

    const userContent = `Job title: ${job.title}
Job description:
${jdText}
${skills ? `Key skills: ${skills}` : ""}

---
Candidate resume (text):
${resumeText.slice(0, 6000)}

Output the JSON only.`;

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 400,
    });

    const raw = chat.choices[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let result: { score?: number; shortlisted?: boolean; screening_notes?: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { score: 0, shortlisted: false, screening_notes: "Could not parse AI response." };
    }

    const score = Math.min(100, Math.max(0, Number(result.score) ?? 0));
    const shortlisted = Boolean(result.shortlisted);
    const screening_notes = String(result.screening_notes ?? "").slice(0, 2000);

    const { error: updateErr } = await supabase
      .from("applicants")
      .update({
        ai_score: score,
        shortlisted,
        screening_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicant_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update applicant", details: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ score, shortlisted, screening_notes }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
