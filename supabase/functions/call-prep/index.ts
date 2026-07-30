import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { applicant_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "hr" } });

    const { data: applicant, error } = await supabase
      .from("applicants")
      .select("full_name, resume_text, current_ctc, expected_ctc, jobs(title, jd)")
      .eq("id", applicant_id)
      .single();

    if (error || !applicant) throw new Error("Applicant not found");

    const prompt = `You are an HR recruiter preparing for a screening call. Based on the candidate's resume and job description, create a concise call prep card.

Candidate: ${applicant.full_name}
Role: ${(applicant.jobs as any)?.title || "Unknown"}
Job Description: ${(applicant.jobs as any)?.jd || "Not provided"}
Resume: ${applicant.resume_text || "Not provided"}
Current CTC: ${applicant.current_ctc || "Not disclosed"}
Expected CTC: ${applicant.expected_ctc || "Not disclosed"}

Respond ONLY with valid JSON in this exact format:
{
  "current_role": "One sentence about their current role/background",
  "key_match": "Top 2-3 matching skills/experience for this role",
  "concern": "One potential concern or gap to probe",
  "salary_intel": "Brief note on CTC situation and what to discuss",
  "opening_line": "A warm, specific opening line to start the call naturally"
}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("OPEN_API") || Deno.env.get("OPENAI_API_KEY")}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 400 }),
    });

    const aiData = await aiRes.json();
    if (!aiData?.choices?.[0]) {
      const openaiError = aiData?.error?.message || "OpenAI returned no completion.";
      return new Response(JSON.stringify({ error: `AI service error: ${openaiError}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const card = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(card), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
