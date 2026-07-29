// HireFlow: AI interview questionnaire generation using OpenAI
// Uses secrets: OPEN_API or OPENAI_API_KEY (same as screen-resume)

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

    const body = await req.json();
    const { job_id, interview_type, custom_topics, jd_text: jdTextOverride } = body;
    if (!job_id || !interview_type) {
      return new Response(
        JSON.stringify({ error: "job_id and interview_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "hr" } });

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, title, jd, skills, dept, exp, type")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const skills = Array.isArray(job.skills) ? job.skills.join(", ") : "";
    const typeLabel = interview_type === "hr" ? "HR Interview" : "Director / Technical Interview";
    const jdContent = (jdTextOverride && String(jdTextOverride).trim()) ? String(jdTextOverride).trim().slice(0, 6000) : (job.jd || "").slice(0, 3000);

    let systemPrompt: string;
    if (interview_type === "hr") {
      systemPrompt = `You are an expert HR interviewer. Generate a structured interview questionnaire for an HR screening round.
Reply ONLY with a valid JSON object — no markdown fences, no preamble. Shape:
{"sections":[{"title":"Section Name","questions":[{"question":"...","purpose":"...","expectedAnswer":"..."}]}]}

Generate these sections:
1. "Behavioral Questions" - 5 questions about past experiences, teamwork, challenges
2. "Situational Questions" - 4 questions about hypothetical workplace scenarios
3. "Culture Fit" - 3 questions about values, work style, team collaboration
4. "Communication & Soft Skills" - 3 questions about communication ability and interpersonal skills

Each question must have: question (the interview question), purpose (why you're asking this), expectedAnswer (what a good answer looks like).`;
    } else {
      systemPrompt = `You are an expert technical interviewer and engineering director. Generate a structured interview questionnaire for a Director/Technical interview round.
Reply ONLY with a valid JSON object — no markdown fences, no preamble. Shape:
{"sections":[{"title":"Section Name","questions":[{"question":"...","purpose":"...","expectedAnswer":"..."}]}]}

Generate these sections:
1. "Technical Depth" - 5 questions testing deep technical knowledge relevant to the role
2. "System Design & Problem Solving" - 4 questions about architecture, scalability, trade-offs
3. "Leadership & Ownership" - 3 questions about leading projects, mentoring, decision-making
4. "Domain Expertise" - 3 questions specific to the job's domain and industry

Each question must have: question (the interview question), purpose (why you're asking this), expectedAnswer (what a strong candidate's answer should cover).`;
    }

    const userContent = `Job Title: ${job.title}
Department: ${job.dept || "Not specified"}
Experience Required: ${job.exp || "Not specified"}
Job Type: ${job.type || "Full-time"}
${skills ? `Key Skills: ${skills}` : ""}

Job Description:
${jdContent}

${custom_topics ? `HR's additional focus areas/topics:\n${custom_topics}` : ""}

Generate the ${typeLabel} questionnaire now.`;

    const openai = new OpenAI({ apiKey });
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 2000,
    });

    const raw = chat.choices[0]?.message?.content?.trim() || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    let parsed: { sections?: any[] };
    try {
      parsed = JSON.parse(clean);
    } catch {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      await supabase.from("questionnaires").insert({
        job_id,
        interview_type,
        custom_topics: custom_topics || null,
        sections: parsed.sections || [],
      });
    } catch {
      // Non-fatal
    }

    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
