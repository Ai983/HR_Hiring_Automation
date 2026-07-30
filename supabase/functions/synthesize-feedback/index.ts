import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { interview_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "hr" } });

    const { data: interview, error } = await supabase
      .from("interviews")
      .select("interview_type, panel, feedback_technical, feedback_communication, feedback_culture_fit, feedback_recommendation, feedback_notes, applicants(full_name, jobs(title))")
      .eq("id", interview_id)
      .single();

    if (error || !interview) throw new Error("Interview not found");

    const avg = ((interview.feedback_technical || 0) + (interview.feedback_communication || 0) + (interview.feedback_culture_fit || 0)) / 3;

    const prompt = `You are an HR manager synthesizing interview panel feedback for a hiring decision.

Candidate: ${(interview.applicants as any)?.full_name}
Role: ${(interview.applicants as any)?.jobs?.title}
Interview Type: ${interview.interview_type?.toUpperCase()}
Panel: ${Array.isArray(interview.panel) ? interview.panel.join(", ") : "HR"}

Scores (out of 5):
- Technical Skills: ${interview.feedback_technical ?? "N/A"}
- Communication: ${interview.feedback_communication ?? "N/A"}
- Culture Fit: ${interview.feedback_culture_fit ?? "N/A"}
- Average: ${avg.toFixed(1)}

Recommendation: ${interview.feedback_recommendation?.toUpperCase()}
Notes: ${interview.feedback_notes || "None"}

Write a concise panel feedback summary (3-4 sentences) that captures the overall assessment, key strengths, any concerns, and the recommendation. Be direct and professional.`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("OPEN_API") || Deno.env.get("OPENAI_API_KEY")}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 300 }),
    });

    const aiData = await aiRes.json();
    if (!aiData?.choices?.[0]) {
      const openaiError = aiData?.error?.message || "OpenAI returned no completion.";
      return new Response(JSON.stringify({ error: `AI service error: ${openaiError}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const summary = aiData.choices[0].message.content.trim();

    return new Response(JSON.stringify({ summary, average_score: parseFloat(avg.toFixed(1)) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
