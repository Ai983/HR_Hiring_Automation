// HireFlow: AI JD enhancement using OpenAI
// Uses secret OPEN_API or OPENAI_API_KEY – set in Edge Function Secrets.

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

    const { title, dept, location, type, exp, salary, extraNotes, jdInput } = await req.json();
    if (!title || !jdInput) {
      return new Response(
        JSON.stringify({ error: "title and jdInput are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a world-class HR copywriter. Reply ONLY with a single valid JSON object — no markdown fences, no preamble. Shape:
{"jd":"<base JD, 120-150 words, professional>","skills":["skill1","skill2","skill3","skill4","skill5","skill6"],"linkedinJD":"<LinkedIn version: professional, story-driven, 100 words>","indeedJD":"<Indeed version: direct, keyword-dense, 100 words>","jobhaiJD":"<JobHai version: clear, role-focused, 100 words>","apnaJD":"<Apna version: concise, opportunity-focused, 100 words>"}`;

    const userContent = `Job Title: ${title}
Department: ${dept || "Not specified"}
Location: ${location || "Not specified"}
Type: ${type || "Full-time"}
Experience: ${exp || "Not specified"}
Salary: ${salary || "Competitive"}
Extra context: ${extraNotes || "none"}

HR's JD (use this as the main content to refine and enhance):
---
${jdInput.slice(0, 4000)}
---

Generate the enhanced JD and portal-specific versions (LinkedIn, Indeed, JobHai, Apna) now.`;

    const openai = new OpenAI({ apiKey });
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 1000,
    });

    const raw = chat.choices[0]?.message?.content?.trim() || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
