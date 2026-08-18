# Hagerstone META Leads — Complete Execution Guide
## Google Sheets → n8n → Supabase → AI → HireFlow Dashboard
**Status as of today:** Google Sheets connected ✅ | Data flowing ✅ | Next: n8n + Supabase + AI

---

## WHAT IS ALREADY DONE ✅

```
Meta Lead Ad Form (Construction Manager)
           ↓  Connected ✅
Google Sheet: "Hagerstone META Leads 2026" → Sheet1
           ↓  Real data confirmed ✅
Columns live: id, created_time, platform, form_name,
              your_experience, type_of_projects, team_size...
```

**3 real leads + 1 test lead already in sheet as of 4-29-2026.**

---

## STEP 1 — MULTIPLE FORMS: SAME SHEET, DIFFERENT TABS

**Your question:** Should all job forms connect to the same spreadsheet?

**Answer: YES — same spreadsheet, but one tab per job role.**

### Why same spreadsheet, different tabs:
- n8n can watch the whole spreadsheet from one connection
- `form_name` column already captures which form a lead came from (you can see this in your sheet)
- HR sees all leads in one place, just switch tabs
- One Google Sheets OAuth connection serves all forms

### How to set up tabs (do this in Google Sheets right now — 5 minutes):

**In "Hagerstone META Leads 2026" Google Sheet:**

1. Right-click "Sheet1" at the bottom → Rename → type `Construction_Manager`
2. Click `+` to add new tabs for each job opening:
   - `Site_Engineer`
   - `Interior_Designer`
   - `MEP_Engineer`
   - `Project_Manager`
   - `ALL_LEADS` ← one master tab (explained below)

**Tab naming rule:** Use underscores, no spaces. n8n references tabs by exact name.

### How to connect NEW forms to their own tab:

Go back to Meta → Lead ads forms → Lead Integration → **"New integration"** button:
1. Select Google Sheets
2. Same spreadsheet: "Hagerstone META Leads 2026"
3. Select the matching tab (e.g., "Site_Engineer" for site engineer form)
4. Map fields → Save

**For the Construction Manager form that's already connected:**
Go to the existing integration → Edit → change Sheet tab from "Sheet1" to "Construction_Manager"

### The ALL_LEADS master tab (optional but recommended):
Add this Google Sheets formula in the `ALL_LEADS` tab cell A1:
```
=QUERY({Construction_Manager!A:Z; Site_Engineer!A:Z; Interior_Designer!A:Z},
"SELECT * WHERE Col1 <> 'id' AND Col1 IS NOT NULL")
```
This gives HR one view of ALL leads across all job forms, sorted by time.

---

## STEP 2 — YOUR CURRENT SHEET COLUMNS (From the live data)

Looking at your screenshot, the sheet has these exact columns:

| Col | Header | What it is |
|-----|--------|------------|
| A | id | Meta's lead ID |
| B | created_time | Timestamp of submission |
| C | ad_id | Which ad drove the lead |
| D | ad_name | Ad name |
| E | adset_id | Ad set ID |
| F | adset_name | Ad set name |
| G | campaign_id | Campaign ID |
| H | campaign_name | Campaign name |
| I | form_id | Form ID |
| J | form_name | Form name (e.g., "Construction Manager") |
| K | is_organic | true/false (paid vs organic) |
| L | platform | "fb" or "ig" |
| M | your_experience | Survey answer: years of experience |
| N | type_of_projects | Survey answer: project types |
| O | team_size | Survey answer: team managed |
| P+ | (more survey answers) | Rest of your form questions |

**Important:** Column names M, N, O etc. come directly from your Meta form field names. Whatever you named the fields in the Instant Form, those become column headers.

---

## STEP 3 — SUPABASE TABLE SETUP

### Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Survey responses table (receives Meta lead data from n8n)
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  source text NOT NULL DEFAULT 'facebook'
    CHECK (source IN ('facebook', 'instagram', 'apna', 'linkedin', 'direct')),
  platform text,                           -- 'fb' or 'ig' from sheet
  form_name text,                          -- "Construction Manager", "Site Engineer" etc
  campaign_name text,
  ad_name text,
  meta_lead_id text UNIQUE,                -- Column A from sheet (prevents duplicates)

  -- Candidate personal details
  full_name text,
  email text,
  phone text,
  current_city text,
  age_range text,

  -- Raw survey answers (everything from col M onwards)
  answers jsonb NOT NULL DEFAULT '{}',
  /*
  Example answers stored:
  {
    "your_experience": "5-8 years",
    "type_of_projects": "residential / commercial",
    "team_size": "10-30 people",
    "joining_availability": "30 din mein",
    "salary_expectation": "40000-60000",
    "tools_known": "AutoCAD, MS Project",
    "currently_employed": "Yes",
    "relocation_ready": "Yes - specific cities",
    "relocation_cities": "Gurugram, Noida"
  }
  */

  -- AI Analysis (filled after Edge Function runs)
  ai_score int CHECK (ai_score BETWEEN 0 AND 100),
  ai_recommendation text CHECK (ai_recommendation IN (
    'strong_recommend', 'recommend', 'borderline', 'reject'
  )),
  ai_one_line text,
  ai_strengths jsonb,                      -- array of strings
  ai_concerns jsonb,                       -- array of strings
  ai_call_priority text CHECK (ai_call_priority IN ('high', 'medium', 'low')),
  ai_suggested_question text,
  ai_salary_fit text,
  ai_analyzed_at timestamptz,

  -- Processing status
  status text DEFAULT 'new'
    CHECK (status IN ('new', 'ai_pending', 'reviewed', 'called', 'converted', 'rejected', 'duplicate')),
  whatsapp_sent boolean DEFAULT false,
  applicant_id uuid,                       -- filled when converted to applicant

  -- Timestamps
  submitted_at timestamptz,               -- from created_time in sheet
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_sr_source ON public.survey_responses(source);
CREATE INDEX IF NOT EXISTS idx_sr_ai_score ON public.survey_responses(ai_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_sr_status ON public.survey_responses(status);
CREATE INDEX IF NOT EXISTS idx_sr_meta_lead_id ON public.survey_responses(meta_lead_id);
CREATE INDEX IF NOT EXISTS idx_sr_form_name ON public.survey_responses(form_name);
CREATE INDEX IF NOT EXISTS idx_sr_created ON public.survey_responses(created_at DESC);

-- RLS
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on survey_responses"
  ON public.survey_responses FOR ALL USING (true) WITH CHECK (true);
```

---

## STEP 4 — SUPABASE EDGE FUNCTION: `analyze-survey-answers`

### Create file: `supabase/functions/analyze-survey-answers/index.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_CONTEXTS: Record<string, any> = {
  "Construction Manager": {
    required_experience: "5+ years",
    key_skills: ["Construction management", "Team leadership", "Budget control", "Client coordination"],
    budget_monthly: 80000,
    joining_deadline: "30 days",
    role_type: "site"
  },
  "Site Engineer": {
    required_experience: "3-5 years",
    key_skills: ["AutoCAD", "Site supervision", "MEP coordination", "Safety management"],
    budget_monthly: 50000,
    joining_deadline: "30 days",
    role_type: "site"
  },
  "Interior Designer": {
    required_experience: "2-5 years",
    key_skills: ["AutoCAD", "3DS Max", "Client presentations", "Material knowledge"],
    budget_monthly: 60000,
    joining_deadline: "15 days",
    role_type: "hq"
  },
  "MEP Engineer": {
    required_experience: "3-6 years",
    key_skills: ["MEP design", "AutoCAD MEP", "Subcontractor management", "Site coordination"],
    budget_monthly: 55000,
    joining_deadline: "30 days",
    role_type: "site"
  },
  "Project Manager": {
    required_experience: "5-8 years",
    key_skills: ["Project scheduling", "Team management", "Client handling", "Budget control"],
    budget_monthly: 90000,
    joining_deadline: "30 days",
    role_type: "hq"
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPEN_API") || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "OpenAI key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { survey_response_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the survey response
    const { data: survey, error } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("id", survey_response_id)
      .single();

    if (error || !survey) return new Response(JSON.stringify({ error: "Survey not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get job context (fallback to generic if form_name not in our map)
    const jobCtx = JOB_CONTEXTS[survey.form_name] || {
      required_experience: "2+ years",
      key_skills: ["Relevant construction/design experience"],
      budget_monthly: 50000,
      joining_deadline: "30 days",
      role_type: "site"
    };

    // Format answers for Claude
    const answersText = Object.entries(survey.answers || {})
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join("\n");

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a Senior Talent Acquisition Lead at Hagerstone, 
an interior design + MEP + civil construction firm with 350 employees and 250+ projects 
across 25 Indian cities. You evaluate site engineer and construction candidates.

Hagerstone site roles need: hands-on experience, ability to manage subcontractors, 
willingness to work in Tier-2 cities, quick joining, salary fit within budget.

Return ONLY valid JSON. No markdown, no preamble. Exact shape:
{
  "score": <0-100>,
  "recommendation": <"strong_recommend"|"recommend"|"borderline"|"reject">,
  "one_line": "<1 sentence for HR's quick scan>",
  "strengths": ["<strength 1>","<strength 2>","<strength 3>"],
  "concerns": ["<concern 1>"],
  "call_priority": <"high"|"medium"|"low">,
  "suggested_question": "<Best first question to ask on the call>",
  "salary_fit": <"within_budget"|"at_limit"|"over_budget"|"unknown">,
  "availability_fit": <"immediate"|"short_wait"|"long_wait"|"unknown">
}

Scoring:
- Experience match (0-25 pts)
- Skills/domain relevance (0-25 pts)  
- Availability fit (0-20 pts)
- Salary fit (0-15 pts)
- Project scale / independence (0-15 pts)`;

    const userContent = `Job Role: ${survey.form_name}
Required Experience: ${jobCtx.required_experience}
Monthly Budget: ₹${jobCtx.budget_monthly}
Key Skills Needed: ${jobCtx.key_skills.join(", ")}
Need to join within: ${jobCtx.joining_deadline}
Role type: ${jobCtx.role_type}

Candidate Survey Answers:
---
${answersText || "No answers provided"}
---

Analyze and return JSON only.`;

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 600,
    });

    const raw = chat.choices[0]?.message?.content?.trim() || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    let result: any;
    try { result = JSON.parse(clean); }
    catch { result = { score: 0, recommendation: "borderline", one_line: "Could not parse AI response" }; }

    // Update survey_responses with AI analysis
    await supabase.from("survey_responses").update({
      ai_score: Math.min(100, Math.max(0, Number(result.score) || 0)),
      ai_recommendation: result.recommendation || "borderline",
      ai_one_line: String(result.one_line || ""),
      ai_strengths: result.strengths || [],
      ai_concerns: result.concerns || [],
      ai_call_priority: result.call_priority || "medium",
      ai_suggested_question: String(result.suggested_question || ""),
      ai_salary_fit: result.salary_fit || "unknown",
      ai_analyzed_at: new Date().toISOString(),
      status: "new"
    }).eq("id", survey_response_id);

    return new Response(JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
```

### Deploy the Edge Function:
```bash
supabase functions deploy analyze-survey-answers
```

---

## STEP 5 — n8n WORKFLOW: Complete Setup

### Flow name: `MetaLeads-GoogleSheets-Processor`

**Create this workflow in n8n. Exact nodes in order:**

---

### NODE 1: Google Sheets Trigger
```
Node type:     Google Sheets Trigger
Operation:     On Row Added (new row detection)
Spreadsheet:   "Hagerstone META Leads 2026"
Sheet:         Construction_Manager  ← (one trigger per tab, OR use "ALL_LEADS" tab)
Poll interval: Every 1 minute
Credentials:   Google OAuth (same account used for Meta connection)
```

**IMPORTANT — Handle multiple tabs:**
Create ONE workflow with multiple Google Sheets Trigger nodes (one per job tab), all feeding into the same processing nodes below. Or use the ALL_LEADS master tab trigger.

---

### NODE 2: Set Variables (clean the data)
```
Node type: Set

Map these fields from the trigger output:
  meta_lead_id   → {{ $json.id }}
  full_name      → {{ $json['full name'] || $json.full_name || '' }}
  email          → {{ $json['email'] || $json.email || '' }}
  phone          → {{ $json['phone number'] || $json.phone_number || '' }}
  platform       → {{ $json.platform }}
  form_name      → {{ $json.form_name }}
  campaign_name  → {{ $json.campaign_name }}
  ad_name        → {{ $json.ad_name }}
  submitted_at   → {{ $json.created_time }}
  source         → {{ $json.platform === 'fb' ? 'facebook' : 'instagram' }}

  answers_json (Expression):
  {{
    JSON.stringify({
      your_experience: $json.your_experience || '',
      type_of_projects: $json.type_of_projects || '',
      team_size: $json.team_size || '',
      currently_employed: $json.currently_employed || $json['are you currently employed'] || '',
      joining_availability: $json.joining_availability || $json['when can you join'] || '',
      salary_expectation: $json.salary_expectation || $json['expected monthly salary'] || '',
      tools_known: $json.tools_known || $json['software tools'] || '',
      relocation_ready: $json.relocation_ready || $json['open to relocation'] || '',
      extra_notes: $json.extra_notes || $json['anything else'] || ''
    })
  }}
```

**Note:** Column headers in n8n come from your Meta form field names. Check your actual column names in the Google Sheet and adjust the mappings above to match exactly.

---

### NODE 3: Supabase — Check Duplicate
```
Node type:     Supabase
Operation:     Get Many
Table:         survey_responses
Filter:        meta_lead_id = {{ $json.meta_lead_id }}
Limit:         1
```

---

### NODE 4: IF — Skip Duplicate
```
Node type:     IF
Condition:     {{ $json.length === 0 }}  ← true means NOT duplicate, continue
True branch:   → Node 5 (insert)
False branch:  → Stop (skip this lead, already processed)
```

---

### NODE 5: Supabase — Insert Survey Response
```
Node type:     Supabase
Operation:     Insert
Table:         survey_responses

Fields:
  meta_lead_id   → {{ $('Set Variables').item.json.meta_lead_id }}
  source         → {{ $('Set Variables').item.json.source }}
  platform       → {{ $('Set Variables').item.json.platform }}
  form_name      → {{ $('Set Variables').item.json.form_name }}
  campaign_name  → {{ $('Set Variables').item.json.campaign_name }}
  ad_name        → {{ $('Set Variables').item.json.ad_name }}
  full_name      → {{ $('Set Variables').item.json.full_name }}
  email          → {{ $('Set Variables').item.json.email }}
  phone          → {{ $('Set Variables').item.json.phone }}
  answers        → {{ $('Set Variables').item.json.answers_json }}
  submitted_at   → {{ $('Set Variables').item.json.submitted_at }}
  status         → "ai_pending"
```

---

### NODE 6: HTTP Request — Call AI Analysis
```
Node type:   HTTP Request
Method:      POST
URL:         https://YOUR_PROJECT_ID.supabase.co/functions/v1/analyze-survey-answers

Headers:
  Content-Type:  application/json
  Authorization: Bearer YOUR_SUPABASE_ANON_KEY

Body (JSON):
  {
    "survey_response_id": "{{ $('Supabase Insert').item.json.id }}"
  }
```

---

### NODE 7: Maytapi — WhatsApp to Candidate
```
Node type:   HTTP Request
Method:      POST
URL:         https://api.maytapi.com/api/YOUR_PRODUCT_ID/YOUR_PHONE_ID/sendMessage

Headers:
  Content-Type: application/json
  x-maytapi-key: YOUR_MAYTAPI_API_KEY

Body (JSON):
  {
    "to_number": "91{{ $('Set Variables').item.json.phone }}@c.us",
    "type": "text",
    "message": "Hi {{ $('Set Variables').item.json.full_name }}! 🙏\n\nHagerstone mein aapki application receive ho gayi hai — {{ $('Set Variables').item.json.form_name }}.\n\nHamare HR team 2 business days mein aapse contact karegi.\n\nShukriya!\n— Hagerstone HR Team"
  }
```

---

### NODE 8: Supabase — Mark WhatsApp Sent
```
Node type:    Supabase
Operation:    Update
Table:        survey_responses
ID field:     id
ID value:     {{ $('Supabase Insert').item.json.id }}
Fields:
  whatsapp_sent → true
  status        → "new"
```

---

### COMPLETE n8n FLOW DIAGRAM:
```
[Google Sheets Trigger]
         ↓
   [Set Variables]
         ↓
[Supabase: Check Duplicate]
         ↓
    [IF: Duplicate?]
    ↓ NO          ↓ YES
[Supabase:      [STOP]
  Insert]
    ↓
[HTTP: AI Analysis]
    ↓
[Maytapi: WhatsApp]
    ↓
[Supabase: Update
  whatsapp_sent=true]
```

---

## STEP 6 — ADD SURVEY LEADS PANEL TO HIREFLOW

### 6A. Update `src/constants.js`

```javascript
// Add to existing constants
export const SURVEY_SOURCES = [
  { id: 'facebook',  label: 'Facebook',  color: '#1877f2', bg: 'rgba(24,119,242,0.08)' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c', bg: 'rgba(225,48,108,0.08)' },
  { id: 'apna',      label: 'Apna',      color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  { id: 'linkedin',  label: 'LinkedIn',  color: '#0a66c2', bg: 'rgba(10,102,194,0.08)' },
];

export const AI_RECOMMENDATIONS = {
  strong_recommend: { label: 'Strong ★',  color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  recommend:        { label: 'Recommend', color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  borderline:       { label: 'Borderline',color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  reject:           { label: 'Reject',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};
```

### 6B. New Service: `src/services/surveyService.js`

```javascript
import { supabase } from '../supabaseClient.js';

export async function fetchSurveyResponses(filters = {}) {
  if (!supabase) return [];
  let query = supabase
    .from('survey_responses')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.source) query = query.eq('source', filters.source);
  if (filters.recommendation) query = query.eq('ai_recommendation', filters.recommendation);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.form_name) query = query.eq('form_name', filters.form_name);

  const { data } = await query.limit(200);
  return data || [];
}

export async function convertToApplicant(surveyId, jobId) {
  if (!supabase) return null;

  // Get survey data
  const { data: survey } = await supabase
    .from('survey_responses')
    .select('*')
    .eq('id', surveyId)
    .single();

  if (!survey) throw new Error('Survey not found');

  // Create applicant
  const { data: applicant, error } = await supabase
    .from('applicants')
    .insert({
      job_id: jobId,
      full_name: survey.full_name,
      email: survey.email,
      phone: survey.phone,
      portal: survey.source,
      stage: 'calling',  // Skip directly to calling — AI already screened
      ai_score: survey.ai_score,
      shortlisted: survey.ai_recommendation === 'strong_recommend',
      screening_notes: survey.ai_one_line,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  // Link survey to applicant
  await supabase.from('survey_responses')
    .update({ applicant_id: applicant.id, status: 'converted' })
    .eq('id', surveyId);

  return applicant;
}

export async function rejectSurveyLead(surveyId) {
  if (!supabase) return;
  await supabase.from('survey_responses')
    .update({ status: 'rejected' })
    .eq('id', surveyId);
}
```

### 6C. New Panel: `src/components/panels/SurveyLeads.jsx`

```jsx
import { useState, useEffect } from 'react';
import { fetchSurveyResponses, convertToApplicant, rejectSurveyLead } from '../../services/surveyService.js';
import { useApp } from '../../context/AppContext.jsx';
import { AI_RECOMMENDATIONS, SURVEY_SOURCES } from '../../constants.js';

export default function SurveyLeads() {
  const { jobs, showToast } = useApp();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ source: '', recommendation: '', status: 'new' });
  const [expanded, setExpanded] = useState(null);
  const [converting, setConverting] = useState(null);

  useEffect(() => {
    loadLeads();
  }, [filters]);

  const loadLeads = async () => {
    setLoading(true);
    const data = await fetchSurveyResponses(filters);
    setLeads(data);
    setLoading(false);
  };

  const handleConvert = async (lead) => {
    // Find matching job by form_name
    const matchingJob = jobs.find(j => j.title.toLowerCase().includes(
      lead.form_name?.toLowerCase().split(' ')[0] || ''
    ));
    const jobId = matchingJob?.id;
    if (!jobId) {
      showToast('No matching job found. Post the job first.', false);
      return;
    }
    setConverting(lead.id);
    try {
      await convertToApplicant(lead.id, jobId);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      showToast(`${lead.full_name} moved to Calling Queue ✓`);
    } catch (e) {
      showToast(e.message || 'Conversion failed', false);
    }
    setConverting(null);
  };

  const handleReject = async (leadId) => {
    await rejectSurveyLead(leadId);
    setLeads(prev => prev.filter(l => l.id !== leadId));
    showToast('Lead rejected.');
  };

  // Stats
  const strong = leads.filter(l => l.ai_recommendation === 'strong_recommend').length;
  const avgScore = leads.length
    ? Math.round(leads.reduce((s, l) => s + (l.ai_score || 0), 0) / leads.length)
    : 0;

  return (
    <div className="fade-in">
      <div className="page-title">Survey Leads</div>
      <div className="page-sub">Meta ads + Apna form submissions — AI analyzed and ranked</div>

      {/* Stats */}
      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { cls: 's1', val: leads.length, lbl: 'Total Leads' },
          { cls: 's3', val: strong, lbl: 'Strong Recommend' },
          { cls: 's2', val: avgScore, lbl: 'Avg AI Score' },
          { cls: 's4', val: leads.filter(l => l.source === 'facebook').length, lbl: 'From Facebook' },
        ].map(s => (
          <div key={s.lbl} className={`stat-card ${s.cls}`}>
            <div className="stat-val">{s.val}{s.lbl === 'Avg AI Score' ? '/100' : ''}</div>
            <div className="stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 160 }}
          value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}>
          <option value="">All Sources</option>
          {SURVEY_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="form-input" style={{ width: 180 }}
          value={filters.recommendation} onChange={e => setFilters(f => ({ ...f, recommendation: e.target.value }))}>
          <option value="">All Recommendations</option>
          {Object.entries(AI_RECOMMENDATIONS).map(([k, v]) =>
            <option key={k} value={k}>{v.label}</option>
          )}
        </select>
        <select className="form-input" style={{ width: 160 }}
          value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="new">New (unreviewed)</option>
          <option value="">All Status</option>
          <option value="reviewed">Reviewed</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Lead Cards */}
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#8a7e72' }}>Loading...</div> :
      leads.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#8a7e72' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>No survey leads yet</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Leads will appear here once Meta form submissions come through Google Sheets → n8n
          </div>
        </div>
      ) : leads.map(lead => {
        const rec = AI_RECOMMENDATIONS[lead.ai_recommendation] || AI_RECOMMENDATIONS.borderline;
        const src = SURVEY_SOURCES.find(s => s.id === lead.source) || {};
        const isExp = expanded === lead.id;
        const answers = lead.answers || {};

        return (
          <div key={lead.id} className="card" style={{ marginBottom: 12, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 16, color: '#1a1612' }}>
                    {lead.full_name || 'Unknown'}
                  </span>
                  <span className="tag" style={{ background: rec.bg, color: rec.color, fontSize: 11 }}>
                    {rec.label}
                  </span>
                  <span className="tag" style={{ background: src.bg || '#f0ece5', color: src.color || '#5a5048', fontSize: 11 }}>
                    {src.label || lead.source}
                  </span>
                  <span style={{ fontSize: 11, color: '#8a7e72' }}>{lead.form_name}</span>
                </div>

                {/* AI one-liner */}
                {lead.ai_one_line && (
                  <div style={{ fontSize: 13, color: '#3a3028', marginBottom: 8, lineHeight: 1.5 }}>
                    <span style={{ color: '#c97a2a', fontWeight: 700 }}>✦ AI: </span>
                    {lead.ai_one_line}
                  </div>
                )}

                {/* Strengths + Concerns */}
                {lead.ai_strengths?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {lead.ai_strengths.map((s, i) => (
                      <span key={i} style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.08)',
                        color: '#15803d', fontSize: 11, fontWeight: 600 }}>✓ {s}</span>
                    ))}
                  </div>
                )}
                {lead.ai_concerns?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {lead.ai_concerns.map((c, i) => (
                      <span key={i} style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.08)',
                        color: '#92400e', fontSize: 11, fontWeight: 600 }}>⚠ {c}</span>
                    ))}
                  </div>
                )}

                {/* Suggested call question */}
                {lead.ai_suggested_question && (
                  <div style={{ padding: '8px 12px', background: '#faf8f5', borderRadius: 8,
                    border: '1px solid #ede6db', fontSize: 12, color: '#5a5048', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700 }}>📞 Ask on call: </span>
                    {lead.ai_suggested_question}
                  </div>
                )}

                {/* Expanded answers */}
                {isExp && (
                  <div style={{ marginTop: 12, padding: 12, background: '#faf8f5', borderRadius: 8,
                    border: '1px solid #ede6db', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: '#1a1612' }}>Full Survey Answers</div>
                    {Object.entries(answers).map(([k, v]) => v ? (
                      <div key={k} style={{ display: 'flex', gap: 8, padding: '4px 0',
                        borderBottom: '1px solid #f0ece5' }}>
                        <span style={{ color: '#8a7e72', minWidth: 180, textTransform: 'capitalize' }}>
                          {k.replace(/_/g, ' ')}
                        </span>
                        <span style={{ color: '#1a1612', fontWeight: 600 }}>{String(v)}</span>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>

              {/* Right side: score + actions */}
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 28,
                  color: lead.ai_score >= 80 ? '#22c55e' : lead.ai_score >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {lead.ai_score ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: '#8a7e72', marginBottom: 12 }}>/ 100</div>

                <button className="btn-gold" style={{ width: '100%', justifyContent: 'center',
                  marginBottom: 6, padding: '8px 12px', fontSize: 12 }}
                  onClick={() => handleConvert(lead)}
                  disabled={converting === lead.id}>
                  {converting === lead.id ? '...' : '→ Calling Queue'}
                </button>
                <button className="btn-outline" style={{ width: '100%', justifyContent: 'center',
                  padding: '7px 12px', fontSize: 12, marginBottom: 6 }}
                  onClick={() => setExpanded(isExp ? null : lead.id)}>
                  {isExp ? 'Hide Answers' : 'View Answers'}
                </button>
                <button className="btn-ghost" style={{ width: '100%', fontSize: 11, color: '#ef4444' }}
                  onClick={() => handleReject(lead.id)}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 6D. Register the panel in `src/App.jsx`

```jsx
// Add import
import SurveyLeads from "./components/panels/SurveyLeads.jsx";

// Add in AppContent render
{panel === "survey" && <SurveyLeads />}
```

### 6E. Add to Sidebar in `src/components/layout/Sidebar.jsx`

```javascript
// Add to navItems array (after "applicants"):
{ id: "survey", icon: "📋", label: "Survey Leads", badge: surveyNewCount },
```

Add `surveyNewCount` by fetching count from `survey_responses` where `status = 'new'`.

---

## STEP 7 — DEPLOYMENT CHECKLIST

### Aniket — Backend (estimated 4-6 hours):

- [ ] Run Step 3 SQL in Supabase Dashboard → SQL Editor
- [ ] Create `supabase/functions/analyze-survey-answers/index.ts` (Step 4 code)
- [ ] Deploy Edge Function: `supabase functions deploy analyze-survey-answers`
- [ ] Verify `OPEN_API` secret is set in Supabase Edge Function secrets
- [ ] Build n8n workflow (Step 5, all 8 nodes)
- [ ] Test n8n with a dummy row in Google Sheet → verify Supabase row created + AI analyzed
- [ ] Set up Maytapi node in n8n (Step 5, Node 7)
- [ ] Connect remaining job forms to their tabs in Google Sheets (Step 1)

### Shubh — Frontend (estimated 3-4 hours):

- [ ] Add `SURVEY_SOURCES` and `AI_RECOMMENDATIONS` to `constants.js` (Step 6A)
- [ ] Create `src/services/surveyService.js` (Step 6B)
- [ ] Create `src/components/panels/SurveyLeads.jsx` (Step 6C)
- [ ] Register panel in `App.jsx` (Step 6D)
- [ ] Add sidebar nav item (Step 6E)
- [ ] Test end-to-end: Lead in sheet → Survey Leads panel → shows AI score + answers

---

## STEP 8 — TESTING PROTOCOL

### Test 1 — Manual row in Google Sheet:
1. Open "Hagerstone META Leads 2026" → Construction_Manager tab
2. Add a test row manually with fake data (name: "Test User", phone: your number, answers filled)
3. Wait 1-2 minutes for n8n to pick it up
4. Check Supabase: `SELECT * FROM survey_responses ORDER BY created_at DESC LIMIT 1`
5. Check that `ai_score` and `ai_one_line` are populated (AI ran successfully)
6. Check your WhatsApp — confirmation message should arrive

### Test 2 — From Meta form:
1. Open your Meta Lead Ad form (the test link from Meta Ads Manager)
2. Fill it out with your own details
3. Submit
4. Wait 2-3 minutes
5. Check Google Sheet → row should appear
6. Check Supabase → row should appear with AI analysis
7. Check HireFlow Survey Leads panel → lead should show

### Test 3 — Duplicate prevention:
Submit the same form twice with same email. Only ONE row should appear in Supabase.

---

## STEP 9 — ONGOING: CONNECTING NEW JOB FORMS

Every time HR creates a new Meta Lead Ad for a new role:

1. **Create the Instant Form** in Meta Ads Manager with the survey questions
2. **Go to Lead Integration** → New Integration → Google Sheets
3. Select "Hagerstone META Leads 2026" → Select the matching tab (or create a new tab)
4. **Update `JOB_CONTEXTS`** in the Edge Function (`analyze-survey-answers/index.ts`) to add the new role's budget, skills, and experience requirements
5. **Redeploy Edge Function**: `supabase functions deploy analyze-survey-answers`
6. n8n picks it up automatically — no changes needed there

---

## SUMMARY TABLE

| What | Who | When | Status |
|------|-----|------|--------|
| Google Sheets connected to Meta (Construction Manager form) | Done | 4-29-2026 | ✅ DONE |
| Rename Sheet1 to "Construction_Manager" | HR/Anyone | Today | ⬜ TODO |
| Create tabs for each job role | HR/Anyone | Today | ⬜ TODO |
| Connect remaining job forms to their tabs | HR/Aniket | Today | ⬜ TODO |
| Run SQL — create survey_responses table | Aniket | Day 1 | ⬜ TODO |
| Deploy analyze-survey-answers Edge Function | Aniket | Day 1 | ⬜ TODO |
| Build n8n workflow (8 nodes) | Aniket | Day 1-2 | ⬜ TODO |
| Test: dummy row → Supabase → AI | Aniket | Day 2 | ⬜ TODO |
| Build Survey Leads panel in HireFlow | Shubh | Day 2-3 | ⬜ TODO |
| End-to-end test from Meta form | Both | Day 3 | ⬜ TODO |
| Go live — run actual Meta campaign | HR | Day 4+ | ⬜ TODO |

---

## COST SUMMARY (Monthly Ongoing)

| Item | Cost |
|------|------|
| Google Sheets integration with Meta | Free |
| n8n self-hosted | Free |
| Supabase (current plan) | Free / existing |
| OpenAI API for AI analysis (100 leads/week) | ~₹800–₹1,500/month |
| Maytapi WhatsApp (confirmations) | ~₹3,000/month |
| Meta Ads budget | HR decides (recommend ₹500/day to start) |
| **Total infra cost** | **~₹4,000–5,000/month** |

---

*Prepared by: AI Solution Architect | Hagerstone HireFlow*
*Data confirmed live as of: 4-29-2026 16:04:45 (Google Sheets connected, 3 real leads + 1 test)*
