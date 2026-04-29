import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { applicant_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: refs, error } = await supabase
      .from("references")
      .select("referee_name, referee_designation, referee_company, relationship, reference_status, feedback_rating, feedback_notes, checked_by, checked_at")
      .eq("applicant_id", applicant_id)
      .eq("reference_status", "completed");

    if (error) throw error;
    if (!refs || refs.length === 0) throw new Error("No completed references found");

    const { data: applicant } = await supabase
      .from("applicants")
      .select("full_name, jobs(title)")
      .eq("id", applicant_id)
      .single();

    const refDetails = refs.map((r, i) =>
      `Reference ${i + 1}: ${r.referee_name} (${r.referee_designation} @ ${r.referee_company}, ${r.relationship})\nRating: ${r.feedback_rating}/5\nNotes: ${r.feedback_notes || "None"}`
    ).join("\n\n");

    const avgRating = refs.reduce((sum, r) => sum + (r.feedback_rating || 0), 0) / refs.length;

    const prompt = `You are an HR manager reviewing reference check results before making a final hiring decision.

Candidate: ${(applicant as any)?.full_name}
Role: ${(applicant as any)?.jobs?.title}
Average Reference Rating: ${avgRating.toFixed(1)}/5

${refDetails}

Respond ONLY with valid JSON in this exact format:
{
  "overall_verdict": "STRONG_HIRE | HIRE | HOLD | NO_HIRE",
  "consistent_strengths": "2-3 strengths mentioned across references",
  "red_flags": "Any concerns raised, or 'None identified'",
  "summary": "2-3 sentence professional summary of the reference checks"
}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 350 }),
    });

    const aiData = await aiRes.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify({ ...result, average_rating: parseFloat(avgRating.toFixed(1)), ref_count: refs.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
