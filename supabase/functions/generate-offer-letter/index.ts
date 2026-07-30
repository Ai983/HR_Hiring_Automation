import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { candidate_name, role_title, joining_date, reporting_manager, joining_type, probation_months } = await req.json();

    if (!candidate_name || !role_title) throw new Error("candidate_name and role_title are required");

    const joiningStr = joining_date ? new Date(joining_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "a date to be confirmed";

    const prompt = `You are writing the opening welcome section of a professional offer letter for Hagerstone, a 350-person interior design and construction firm in India.

Write a warm, professional welcome paragraph (4-5 sentences) addressed to ${candidate_name} for the role of ${role_title}. Include:
- A genuine congratulations on their selection
- A brief mention of Hagerstone's culture (creative excellence, collaborative projects)
- Their joining date of ${joiningStr}
- Reference to their probation period of ${probation_months || 6} months
- A line about looking forward to their contributions

Do NOT mention any salary figures, CTC, or compensation — that will be added separately.
Do NOT add any headers or subject lines — just the paragraph text.
Keep it under 120 words.`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("OPEN_API") || Deno.env.get("OPENAI_API_KEY")}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 200 }),
    });

    const aiData = await aiRes.json();
    if (!aiData?.choices?.[0]) {
      const openaiError = aiData?.error?.message || "OpenAI returned no completion.";
      return new Response(JSON.stringify({ error: `AI service error: ${openaiError}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const welcome_paragraph = aiData.choices[0].message.content.trim();

    return new Response(JSON.stringify({ welcome_paragraph }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
