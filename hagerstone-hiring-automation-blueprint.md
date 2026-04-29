# Hagerstone HireFlow — Full Automation Blueprint
### From Job Posting to Onboarding + Document Collection
**Version:** 1.0 | **Date:** April 2026 | **For:** Shubh + Aniket (Dev) + Dhruv (MD Approval)

---

## COVER SUMMARY

Teen deliverables plan hai iss document mein:
1. **Stage-by-Stage Automation Map** — Tumhare exact 8 stages ko cover karta hai
2. **AI Agent + n8n Flow Blueprint** — Har stage ke liye kya use karo
3. **Dev Task List** — Kya banana hai, kiska owner hai, priority kya hai

**Starting point:** HireFlow repo already has Modules 1–3 (Posting, Screening, Kanban). 
**Gap:** Calling stage, Interview coordination, Reference Check, Onboarding, and Document Collection — all missing.
**Recommended start:** Phase A (Posting → Screening → Calling) in 3 weeks, then Phase B (Interview → Reference → Offer) in 3 weeks, then Phase C (Onboarding + Docs) in 4 weeks.

---

## PART 1 — CURRENT SYSTEM AUDIT

### What Exists Today in HireFlow Repo

| Module | Status | Evidence |
|--------|--------|----------|
| Job Posting (LinkedIn, Indeed, Apna, JobHai) | ✅ Complete | `PostJob.jsx`, `enhance-jd` Edge Function |
| AI JD Enhancement | ✅ Complete | `enhanceJD()` in `aiService.js` |
| Resume Upload + Storage | ✅ Complete | `ResumeUploadModal.jsx`, Supabase Storage |
| AI Resume Screening (Score + Shortlist) | ✅ Complete | `screen-resume` Edge Function, OpenAI GPT-4o-mini |
| Kanban Board (stages: new→screening→interview→offer→hired→rejected) | ✅ Complete | `Applicants.jsx` |
| Interview Questionnaire Generator | ✅ Complete | `Questionnaire.jsx`, `generate-questionnaire` Edge Function |
| Resume Report (ranked by AI score) | ✅ Complete | `ResumeReport.jsx` |
| **Facebook / Instagram Ads posting** | ❌ Missing | No Meta API integration |
| **Calling Stage (HR phone screen)** | ❌ Missing | No call log, no calling queue |
| **Interview Scheduling** | ❌ Missing | No calendar integration, no panel invite |
| **Reference Check** | ❌ Missing | No reference form, no BGV workflow |
| **Offer Letter Generation** | ❌ Missing | No offer template, no eSign |
| **Onboarding Orchestration** | ❌ Missing | No joinings table, no handoff flows |
| **Document Collection Portal** | ❌ Missing | No doc checklist, no WhatsApp collection |
| **WhatsApp Candidate Comms (Maytapi)** | ❌ Missing | No Maytapi integration anywhere |

### Current DB Tables
```
public.jobs         — job postings with portal_status JSONB
public.applicants   — candidates with resume_text, ai_score, stage
public.questionnaires — AI-generated interview questions
storage.resumes     — resume files bucket
```

### What Needs to Be Added (New Tables)
```
public.call_logs        — HR calling stage notes and outcomes
public.interviews       — scheduled interviews with panel + slot
public.references       — reference check records per candidate
public.offers           — offer letter records with CTC and status
public.joinings         — onboarding tracking per hired candidate
public.documents        — document checklist per joining
```

---

## PART 2 — YOUR 8-STAGE HIRING PIPELINE (FULL AUTOMATION MAP)

```
[STAGE 1] Job Posting
     ↓
[STAGE 2] Application Received  
     ↓
[STAGE 3] AI Screening
     ↓
[STAGE 4] Calling (HR Phone Screen)
     ↓
[STAGE 5] Interview
     ↓
[STAGE 6] Reference Check
     ↓
[STAGE 7] Offer + Onboarding
     ↓
[STAGE 8] Document Collection
```

---

## STAGE 1 — JOB POSTING

### Current State
LinkedIn, Indeed, Apna, JobHai — ✅ JD enhancement done, copy-paste workflow.

### What to Add

#### 1A. Facebook + Instagram Ads Integration
**Type:** n8n deterministic flow (NO AI needed for posting mechanics)

**How it works:**
- HR fills job form → selects "Facebook/Instagram" as channel
- n8n calls Meta Marketing API to create a Lead Ad or Traffic Ad
- Target audience: set by role type (white-collar → LinkedIn interest targeting; blue-collar → location + job-seeker targeting)
- Budget: HR enters ₹500–₹2000 per job, n8n creates the campaign

**What Shubh needs to build:**
- Add `facebook` and `instagram` to `PORTALS` array in `constants.js`
- Add portal chips in `PostJob.jsx`
- Create n8n workflow: `JobPosting-MetaAds-Flow`
  - Trigger: Supabase webhook on `jobs` row insert with `portal_status.facebook.status = 'live'`
  - Action: POST to `https://graph.facebook.com/v19.0/{ad_account_id}/ads`
  - Store `campaign_id` back in `jobs.portal_status.facebook.campaign_id`

**Meta API credentials needed:**
- Meta Business Manager account
- Ad Account ID
- Page Access Token (long-lived)
- Store in Supabase Edge Function Secrets as `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID`

#### 1B. Naukri.com Integration (Add for maximum reach)
**Type:** n8n deterministic + manual fallback

Naukri has an enterprise API. For now: n8n generates the formatted posting → sends to HR email as ready-to-paste content. When Naukri API access is obtained, replace with direct call.

#### 1C. JD Improvement — Add Hagerstone-Specific Tone
**Current issue:** The AI prompt is generic. Add Hagerstone context.

**Fix in `enhance-jd/index.ts`:** Update system prompt to include:
```
Hagerstone is a 350-person interior design + MEP + civil construction firm.
Roles are either HQ white-collar (designers, engineers, PM, sales, finance, AI team)
or on-site blue-collar (site supervisors, MEP workers, helpers).
Use professional but direct Hindi/English mixed tone for blue-collar roles.
Use formal English for HQ roles.
```

#### 1D. Automated Re-posting Reminder
**Type:** n8n scheduled flow — `JobRepost-Reminder-Flow`

- Every 7 days: check `jobs` where `portal_status.*.status = 'live'` and `applicants count < 5`
- Send WhatsApp to HR: "Job [Title] has only 3 applicants after 7 days. Boost budget ya naya channel add karein?"
- One-click "Boost" button in WhatsApp triggers Meta campaign budget increase via API

---

## STAGE 2 — APPLICATION RECEIVED

### Current State
Manual upload via `ResumeUploadModal`. No inbound email/portal scraping.

### What to Add

#### 2A. Inbound Email Parser — `EmailParser-Applicant-Flow` (n8n)
**Type:** n8n deterministic

- Gmail label "Hagerstone Careers" → n8n Gmail trigger
- n8n extracts: name, email, phone from email body
- Attachment (PDF resume) → saves to Supabase Storage
- Creates `applicants` row with `stage = 'new'`
- Triggers Stage 3 (AI screening) automatically

**Setup:** Create `careers@hagerstone.com`, forward to n8n Gmail webhook.

#### 2B. WhatsApp Application (Maytapi)
**Type:** n8n + Maytapi webhook

Candidates can apply by WhatsApp:
- Candidate sends CV to +91-XXXX-XXXXXX (dedicated Maytapi number)
- Maytapi webhook → n8n → extracts PDF → saves to Storage → creates applicant row
- Auto-reply: "Aapka CV mil gaya! Hum 2 din mein contact karenge. — Hagerstone HR"

#### 2C. Auto-Acknowledgement to Candidate
**Type:** n8n deterministic (Email + WhatsApp)

**Triggered by:** New row in `applicants` table (Supabase webhook)

**Email template:**
```
Subject: Application Received — [Job Title] | Hagerstone

Dear [Name],

Thank you for applying for [Job Title] at Hagerstone.
We have received your application and our team will review it within 2 business days.

Best regards,
Hagerstone HR Team
```

**WhatsApp (Maytapi):**
```
Hi [Name]! 👋 Hagerstone mein aapka application receive ho gaya hai — [Job Title].
2 din mein update milega. Tab tak ke liye shukriya! 🙏
```

**Why n8n not Claude here?** Acknowledgement is a fixed template — no generation needed. Classic deterministic send.

---

## STAGE 3 — AI SCREENING

### Current State
✅ Already working. OpenAI GPT-4o-mini scores 0–100, shortlists, writes screening_notes.

### Improvements Needed

#### 3A. Auto-Trigger Screening After Upload
**Current issue:** HR has to manually click "Screen with AI" in applicant modal.

**Fix:** After `createApplicant()` succeeds in `ResumeUploadModal.jsx`, immediately call `screenApplicant()` in the same flow. (This is already partially done — complete it for all paths.)

#### 3B. Batch Screening Dashboard
**Add a "Screen All Unscreened" button** in `ResumeReport.jsx`:
- Finds all applicants with `score = 0` and `resume_text IS NOT NULL`
- Calls `screenApplicant()` in sequence with 500ms delay between calls
- Shows progress bar

#### 3C. Screening Quality — Upgrade the Prompt
Current prompt scores on JD match. Add Hagerstone-specific scoring criteria:

**For HQ roles (designers, PM, engineers):**
```
Score boost (+10): Portfolio link present, relevant firm experience, certifications
Score penalty (-15): No experience in interior/construction sector
Auto-reject criteria: Less than 1 year experience for 3-5 yr role
```

**For site roles (site supervisors, MEP workers):**
```
Score boost: Site experience in Tier-2 cities, ITI certification, contractor background
Key skills: AutoCAD, site safety, subcontractor management
```

#### 3D. Duplicate Detection
**Type:** Classic deterministic code (NOT AI)

Before creating a new applicant, check:
1. Exact match on `email` → block as duplicate
2. Exact match on `phone` → flag as possible duplicate, ask HR
3. This prevents same candidate applying 3 times from different portals inflating your numbers.

**Add in `applicantService.js`:**
```javascript
export async function checkDuplicate(email, phone) {
  const { data } = await supabase
    .from('applicants')
    .select('id, full_name, stage')
    .or(`email.eq.${email},phone.eq.${phone}`)
    .limit(1)
  return data?.[0] || null
}
```

---

## STAGE 4 — CALLING (HR PHONE SCREEN)

### Current State
❌ Completely missing. This is the biggest operational gap right now.

### What to Build

#### 4A. New DB Table — `call_logs`
```sql
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  called_by text NOT NULL,             -- HR name
  call_date timestamptz DEFAULT now(),
  call_status text NOT NULL CHECK (call_status IN (
    'connected', 'not_picked', 'callback_requested', 'rejected_on_call', 'moved_to_interview'
  )),
  call_notes text,                     -- HR's notes from the call
  callback_time timestamptz,           -- if candidate asked for callback
  created_at timestamptz DEFAULT now()
);
```

#### 4B. Calling Queue UI — New Panel in HireFlow
**Add `panel = "calling"` to Sidebar:**

```
📞 Calling Queue   [badge: count of shortlisted not-yet-called]
```

**Calling Queue Panel shows:**
- List of shortlisted candidates (score ≥ 70, stage = 'screening')
- Sorted by AI score descending
- Each card: Name | Role | Score | Phone | "Log Call" button
- "Log Call" opens a modal: outcome dropdown + notes textarea
- On submit: creates `call_logs` row + moves applicant to next stage or marks callback

#### 4C. AI Call Prep Card — `CallPrep-Agent` (Claude)
**Triggered:** When HR opens the "Log Call" modal for an applicant

**What it does:** Claude reads the applicant's `resume_text` + job JD and generates a 5-bullet call prep card:

```
Role: [JD-Architect Agent]
Input: resume_text, job.jd, job.title
Output: {
  "current_role": "Currently at X as Y",
  "key_match": "3 years CAD experience matches your requirement",
  "concern": "Gap of 8 months in 2023 — ask about it",
  "salary_intel": "Current CTC likely ₹4–6L based on profile",
  "opening_line": "Hi [Name], I'm calling from Hagerstone HR regarding [Role]..."
}
```

**Why Claude here:** Unstructured resume → structured calling intel. Judgment required.
**Why not n8n:** n8n can't read a resume and extract "what to probe on the call."

**Implementation:** Add a `callprep` API call in `aiService.js`, invoke in the calling modal.

#### 4D. Callback Reminder Loop — n8n Deterministic
**Flow: `CallbackReminder-Flow`**

- Every 30 minutes: check `call_logs` where `call_status = 'callback_requested'` and `callback_time <= now()`
- Send WhatsApp to HR: "Callback due: [Name] | [Phone] | Note: [callback note]"
- This prevents callbacks from falling through the cracks.

#### 4E. Not-Picked Retry Flow — n8n
**Flow: `CallRetry-Flow`**

- If `call_status = 'not_picked'` and fewer than 3 attempts logged:
  - Wait 4 hours, send WhatsApp to candidate: "Hi [Name], Hagerstone HR se call karna tha [Role] ke liye. Kya aap 30 min mein available hain? — HR Team"
- After 3 attempts with no response: auto-move to `rejected` stage, log reason as "No response after 3 attempts"

---

## STAGE 5 — INTERVIEW

### Current State
❌ Missing. Interview Questionnaire exists but no scheduling, no panel coordination.

### What to Build

#### 5A. New DB Table — `interviews`
```sql
CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  interview_type text CHECK (interview_type IN ('hr', 'technical', 'director', 'final')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  mode text CHECK (mode IN ('in_person', 'google_meet', 'phone')),
  meet_link text,                         -- Google Meet link
  panel text[],                           -- array of interviewer emails
  venue text,                             -- if in_person
  status text DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'
  )),
  feedback jsonb,                         -- structured feedback from panel
  outcome text CHECK (outcome IN ('pass', 'fail', 'hold')),
  created_at timestamptz DEFAULT now()
);
```

#### 5B. Interview Scheduler UI
**Add "Schedule Interview" button** in the Applicant modal (visible when `stage = 'interview'`):

Modal fields:
- Interview type (HR / Technical / Director / Final)
- Date + Time picker
- Mode (Google Meet / In-person / Phone)
- Panel members (multi-select from a list of Hagerstone employees)
- Duration

On submit:
- Creates `interviews` row
- Triggers `InterviewSchedule-Flow` (n8n)

#### 5C. Interview Scheduling n8n Flow — `InterviewSchedule-Flow`
**Type:** n8n deterministic (NO LLM — calendar logic is arithmetic)

**Steps:**
1. Receive interview details from Supabase webhook
2. Create Google Calendar event with all panel members as attendees
3. Generate Google Meet link (or add venue)
4. Send email to candidate with calendar invite + Meet link
5. Send WhatsApp to candidate (Maytapi): 
   ```
   Hi [Name]! Hagerstone interview schedule ho gayi hai 🎉
   📅 [Date] at [Time]
   📍 [Mode: Google Meet / Office]
   🔗 [Meet link if applicable]
   Koi questions? Reply karein is number pe. — HR Team
   ```
6. Send reminder email + WhatsApp 24 hours before and 1 hour before

#### 5D. Interview Questionnaire Auto-Attach
**Current state:** Questionnaire panel exists but is disconnected from the interview schedule.

**Fix:** When an interview is scheduled, auto-generate questionnaire for that role + interview type and attach to the calendar event as a Google Doc link. Panel gets it in their calendar invite.

#### 5E. Reschedule Flow — n8n
**Trigger:** HR clicks "Reschedule" in interview card

**Flow:**
1. Candidate gets WhatsApp: "Interview reschedule ki gayi hai. Nayi slot: [New Date/Time]. Confirm karo reply mein."
2. Candidate replies "confirm" or "not available"
3. If "not available": HR gets WhatsApp ping to pick new slot
4. Calendar event updated automatically

#### 5F. Interview Feedback Collector
**After interview status set to 'completed':**

Each panel member gets an email + WhatsApp link to a structured feedback form:
```
Candidate: [Name]
Role: [Role]
Rate on: Technical Skills (1-5) | Communication (1-5) | Culture Fit (1-5)
Recommendation: HIRE / HOLD / REJECT
Comments: [text]
```

Feedback stored in `interviews.feedback` JSONB. HR sees aggregated score in applicant card.

#### 5G. Feedback Synthesizer Agent (Claude)
**Triggered:** When all panel members have submitted feedback

**What it does:** Claude reads all panel feedback JSONs and writes a 3-para summary:
- Overall consensus
- Key strengths noted by panel
- Concerns raised
- Recommendation with reasoning

**Why Claude:** Synthesizing N people's opinions into a coherent brief requires judgment.
**Why not n8n:** n8n can average numbers but can't synthesize qualitative notes.

---

## STAGE 6 — REFERENCE CHECK

### Current State
❌ Completely missing.

### What to Build

#### 6A. New DB Table — `references`
```sql
CREATE TABLE public.references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  referee_name text NOT NULL,
  referee_designation text,
  referee_company text,
  referee_phone text,
  referee_email text,
  relationship text,                    -- "Direct Manager", "Colleague", "Client"
  reference_status text DEFAULT 'pending' CHECK (reference_status IN (
    'pending', 'contacted', 'completed', 'unreachable'
  )),
  feedback_rating int CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_notes text,
  checked_by text,
  checked_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

#### 6B. Reference Collection Flow
**Triggered:** When applicant stage moves to `offer` (reference check happens before final offer in your pipeline)

**Step 1 — Collect referee details from candidate:**
WhatsApp to candidate (Maytapi):
```
Hi [Name]! 🎊 Aap interview round clear kar liya!
Hum aapka reference check karne wale hain. Please 2 referees ka naam, designation, company aur phone number share karein.
Format: Naam | Company | Designation | Phone
Reply is number pe directly.
```

Candidate's WhatsApp reply → n8n parses → creates `references` rows.

**Step 2 — HR calls referees:**
Calling Queue panel mein "Reference Calls" tab add karo.
HR calls each referee, logs notes in the reference form.

**Step 3 — Reference Summary Agent (Claude):**
After both references completed:
```
Input: reference_notes from both referees
Output: {
  "overall_verdict": "Strong Recommend / Recommend / Caution / Reject",
  "consistent_strengths": [...],
  "red_flags": [...],
  "summary": "2-para narrative for HR file"
}
```

**Why Claude:** Qualitative notes from 2 different people → structured verdict requires understanding, not math.

#### 6C. BGV (Background Verification) — Third-Party Integration
For senior roles (salary > ₹10L, project manager and above):

- Integrate **AuthBridge** or **IDfy** API
- Trigger BGV check when reference check is done
- BGV covers: employment verification, education, criminal record
- Cost: ~₹800–₹2000 per check (only for senior roles — budget accordingly)
- BGV status tracked in `references` table with `bgv_status` column

**Implementation:**
```javascript
// In n8n: POST to AuthBridge API
// Payload: name, dob, current employer, education details
// Store report_id, poll for completion webhook
```

---

## STAGE 7 — OFFER + ONBOARDING

### Current State
❌ Completely missing.

### What to Build

#### 7A. New DB Tables
```sql
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id),
  job_id uuid REFERENCES public.jobs(id),
  ctc_gross_annual numeric NOT NULL,          -- NEVER AI-generated. HR inputs this.
  ctc_breakup jsonb,                          -- {basic, hra, special_allowance, pf, ...}
  joining_date date,
  probation_months int DEFAULT 6,
  offer_letter_url text,                      -- Supabase storage path
  esign_status text DEFAULT 'draft' CHECK (esign_status IN ('draft', 'sent', 'signed', 'declined')),
  offer_status text DEFAULT 'pending' CHECK (offer_status IN (
    'pending', 'accepted', 'negotiating', 'declined', 'withdrawn'
  )),
  negotiation_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.joinings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id),
  offer_id uuid REFERENCES public.offers(id),
  employee_id text,                           -- assigned after joining
  joining_date date NOT NULL,
  joining_location text,                      -- HQ / Site name + city
  joining_type text CHECK (joining_type IN ('hq', 'site')),
  reporting_manager_email text,
  status text DEFAULT 'pre_joining' CHECK (status IN (
    'pre_joining', 'doc_pending', 'doc_submitted', 'day1_ready',
    'joined', 'induction_done', 'probation_active', 'confirmed'
  )),
  -- Handoff flags
  it_request_sent boolean DEFAULT false,      -- laptop/email setup
  finance_setup_done boolean DEFAULT false,    -- payroll, PF, bank
  kra_set boolean DEFAULT false,              -- KRA with manager
  attendance_enrolled boolean DEFAULT false,   -- biometric/geo-fence
  induction_done boolean DEFAULT false,
  probation_end_date date,
  probation_reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

#### 7B. Offer Letter Generator (Claude Agent)
**IMPORTANT:** CTC numbers come from HR input — NEVER AI-generated.
Claude only writes the personalised welcome paragraph and formats the letter.

**Flow:**
1. HR enters: Candidate name, Role, CTC gross, joining date, probation period
2. CTC breakup calculated by deterministic code:
   ```javascript
   function computeCtcBreakup(grossAnnual) {
     return {
       basic: grossAnnual * 0.40,
       hra: grossAnnual * 0.20,
       special_allowance: grossAnnual * 0.30,
       pf_employee: grossAnnual * 0.048,     // 12% of basic
       pf_employer: grossAnnual * 0.048,
       gratuity: grossAnnual * 0.0481,
       take_home_monthly: (grossAnnual * 0.892) / 12
     }
   }
   ```
3. Claude generates the offer letter using the deterministic breakup + Hagerstone standard template
4. Letter saved as PDF to Supabase Storage
5. Sent to candidate via email + WhatsApp for eSign (use Leegality or DigiLocker)

#### 7C. Onboarding Orchestrator Agent (Claude + Tools) — THE MOST IMPORTANT AGENT
**This is the canonical case for a Claude agent in this system.**

**Trigger:** `offers.offer_status = 'accepted'`

**What it orchestrates (5 parallel tracks):**

**Track 1 — Document Collection:**
WhatsApp to candidate (Maytapi):
```
Congratulations [Name]! 🎉 Aapka offer accept ho gaya.
Joining date: [Date]
Kripya yeh documents 7 din mein WhatsApp pe bhejein:
1. Aadhaar card (front + back)
2. PAN card
3. Last 3 months ka salary slip
4. Previous company ka offer letter / experience letter
5. Education certificates (10th, 12th, Graduation)
6. Bank passbook/cancelled cheque
7. Passport size photo (3 copies)

Koi document missing hai toh joining delay ho sakti hai.
— Hagerstone HR
```

**Track 2 — IT Handoff (HQ roles):**
Auto-create IT request (email to IT team):
```
Subject: New Joining — IT Setup Required
Name: [Name] | Role: [Role] | Joining: [Date]
Required: Laptop (specs: [by role]), Email ID [firstname.lastname@hagerstone.com],
Software access: [determined by role template]
SLA: Setup ready 1 day before joining date.
```

**Track 3 — Finance Handoff:**
Auto-email to Finance:
```
Subject: New Joiner — Payroll Setup
Employee: [Name] | Role: [Role] | Joining: [Date]
CTC: ₹[X] | PF: Yes | ESI: [based on CTC]
Bank details: [collected from candidate]
Setup PF/ESI/TDS before joining date.
```

**Track 4 — Site Handoff (site roles only):**
WhatsApp to Site Lead:
```
[Site Lead Name], naya supervisor join kar raha hai:
Naam: [Name] | Role: [Role] | Joining: [Date] at [Site]
PPE required: [list by role]
Site induction: Schedule karo joining ke pehle din.
Accommodation: [if applicable — check]
```

**Track 5 — Reporting Manager:**
Email to manager:
```
Subject: New Team Member Joining — KRA Setup Required
[Name] is joining as [Role] on [Date] reporting to you.
Action required: Set KRA within 3 days of joining.
Probation period: [X] months ends on [Date].
```

**Agent Prompt Skeleton:**
```
You are the onboarding lead at Hagerstone. A new employee is joining.
Their details: {joining_record}.
Your job: Check status of all 5 tracks above, send reminders to whoever is stuck,
escalate to HR head if any track is blocked for > 48 hours.
Always log every action to joinings.audit_log.
Available tools: Supabase MCP, Maytapi API, Gmail API.
Never change CTC, joining date, or role — those are set by HR only.
```

**Why Claude and not n8n?** Because HQ joining logic is different from site joining. A senior designer gets a MacBook; a site supervisor gets PPE + accommodation check + geo-fence enrollment. An n8n graph with all these branches would have 60+ nodes and nobody can debug it.

#### 7D. Joining Day Checklist — HireFlow UI Addition
**New panel:** `Onboarding` in sidebar

Shows per-joiner:
- Progress bar: Pre-joining → Docs → IT Ready → Day-1 → Induction → KRA Set → Probation
- Each track shows green/orange/red status
- One-click "Send Reminder" for any stuck track
- HR can mark each item done

#### 7E. Probation Reminder Flow — n8n Deterministic
**Flow: `ProbationReminder-Flow`**

- Daily cron at 9 AM: Check `joinings` where `probation_end_date - now() IN (30, 15, 7, 1)` days
- Send email to HR + reporting manager: "Probation ending in X days for [Name]. Confirm or extend?"
- If no action in 7 days after probation end: HR gets escalation WhatsApp
- **This alone prevents the "confirmation letter arrives 2 months late" problem Hagerstone faces today.**

---

## STAGE 8 — DOCUMENT COLLECTION

### Current State
❌ Completely missing. Most companies do this via WhatsApp threads and physical files.

### What to Build

#### 8A. New DB Table — `documents`
```sql
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  joining_id uuid NOT NULL REFERENCES public.joinings(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN (
    'aadhaar', 'pan', 'salary_slip_1', 'salary_slip_2', 'salary_slip_3',
    'previous_offer_letter', 'experience_letter', 'education_10th',
    'education_12th', 'education_graduation', 'education_postgrad',
    'bank_passbook', 'cancelled_cheque', 'photo', 'passport'
  )),
  file_path text,                          -- Supabase Storage path
  file_url text,                           -- public URL
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'verified', 'rejected', 'not_applicable'
  )),
  verification_notes text,
  verified_by text,
  verified_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

#### 8B. Document Collection UI
**In the Onboarding panel, each joiner card has a "Documents" tab:**

- Shows a checklist of all required documents
- Status: Pending / Submitted / Verified / Not Applicable
- HR can click each row to view the submitted file
- Red badge shows how many docs are still pending

#### 8C. WhatsApp Document Collection Bot (Claude + Maytapi)
**The key insight:** Candidates send documents via WhatsApp because that's what they use. Build the collection there, not on a web form.

**Flow:**
1. After offer acceptance: Candidate gets a WhatsApp message with the document list (Stage 7C, Track 1)
2. Candidate sends document photos/PDFs to the dedicated Maytapi number
3. Maytapi webhook → n8n receives the file + sender's phone number
4. n8n matches phone to `applicants` table → gets `joining_id`
5. File saved to Supabase Storage in `/documents/{joining_id}/{doc_type}/`
6. Claude Vision Agent runs on each received image:

**Document Validator Agent (Claude Vision):**
```
Input: image/PDF of Aadhaar / PAN / salary slip
Output: {
  "doc_type_detected": "aadhaar",
  "name_on_doc": "Rahul Kumar",
  "matches_applicant_name": true,
  "doc_number": "XXXX XXXX 1234",
  "is_readable": true,
  "issues": [] or ["Photo blurred", "Back side missing"]
}
```

7. If validated OK: `documents.status = 'submitted'`, candidate gets WhatsApp: "✅ Aadhaar received!"
8. If issue detected: "⚠️ Aadhaar photo blur hai. Dobara clear photo bhejein."
9. If all documents submitted: Candidate gets: "🎉 Saare documents mil gaye! Joining ke liye taiyaar hain!"

**Why Claude Vision:** OCR + name matching + quality check on a photo — this is multimodal understanding, not deterministic logic.
**Why NOT Claude:** The file routing (phone → joining_id → storage path) is pure deterministic n8n.

#### 8D. Document Reminder Loop — n8n
**Flow: `DocReminder-Flow`**

- Every 2 days: Check joinings where `status = 'doc_pending'` and joining_date < 7 days away
- Find which docs are still `pending` in `documents` table
- WhatsApp to candidate: "Joining mein sirf 7 din baaki hain! Yeh documents abhi bhi pending hain: [list]. Please aaj hi bhejein."
- If joining_date < 2 days and docs still missing: WhatsApp to HR: "⚠️ [Name] ke documents incomplete hain. Joining delay ho sakti hai."

#### 8E. Document Completeness Gate
**In the Onboarding panel:** HR cannot mark `joinings.status = 'day1_ready'` unless either:
- All mandatory docs are `verified`, OR
- HR has explicitly ticked "Override — joining allowed with pending docs"

This prevents the common situation where someone joins and their file is incomplete for months.

---

## PART 3 — ADDITIONAL AUTOMATIONS (BEYOND YOUR 8 STAGES)

### A. Candidate Rejection Communication (All stages)
**This is where most companies lose brand goodwill.**

After any stage rejection (screening, calling, interview):
- Wait 3 days (don't reject same day — feels impersonal)
- Send personalised rejection via email + WhatsApp

**Reject Letter Personalizer (Claude):**
```
Input: applicant name, role, stage_rejected_at, top strength from screening_notes
Output: Kind rejection letter that:
- Mentions one genuine strength ("Your 4 years of CAD experience was impressive")
- Does NOT reveal score or internal reasoning
- Encourages reapplication in 6 months
- Never uses "overqualified" or "not the right fit" as the only reason
```

**Why Claude:** Rejection letters should feel human. A template sounds like a template.

### B. Talent Pool / Bench Tracking
**Problem:** Great candidates rejected at offer stage (because role was filled) are lost forever.

**Solution:** 
- New `talent_pool` table: Name, Role fit, Skills, Last contacted, Pool status
- When HR rejects at offer stage: prompt "Add to talent pool? Role might reopen."
- Every 90 days: Claude scans new open positions and checks if any talent-pool candidate matches → WhatsApp to HR: "Meera Shah 3 months pehle ke candidate hai, current Site Engineer opening ke liye 91/100 match kar rahi hai. Recontact karein?"

### C. HR Analytics Dashboard (Add to Dashboard panel)

**Metrics to show:**
- Average time-to-hire per role (posting date to offer accepted date)
- Stage conversion rates (Applications → Screened → Called → Interviewed → Offered → Hired)
- Source effectiveness (LinkedIn vs Apna vs Facebook — cost per hire)
- Average AI screening score of hired vs rejected candidates (calibrates scoring over time)
- Open positions aging report (roles open > 30 days flagged in red)

**All deterministic queries from Supabase — no AI needed.**

### D. WhatsApp Status Bot (Maytapi)
Candidates often call HR to check their status. This wastes HR time.

**Candidate texts the HR WhatsApp number:** "Status kya hai mera?"

**Bot replies (n8n → look up by phone number):**
```
Hi [Name]! Aapka application status:
Role: [Job Title]
Current Stage: [Interview Scheduled for Dec 15]
Next step: [Interview on Dec 15 at 3 PM via Google Meet]
Link: [meet link]
Koi sawaal ho toh HR se directly baat karein: [HR email]
```

**Why Claude NOT needed here:** Status is a database lookup — deterministic. 
**Exception:** If candidate asks "main pass hua ya nahi?" — that's a judgment call. Bot then escalates to HR.

### E. Referral Program Automation
Internal employees refer candidates → tracked in system.

```sql
ALTER TABLE public.applicants ADD COLUMN referred_by_employee_email text;
ALTER TABLE public.applicants ADD COLUMN referral_bonus_paid boolean DEFAULT false;
```

When referral hire completes 90 days: n8n auto-notifies Finance to process referral bonus.

### F. Seasonal Hiring Forecast (Advanced — Phase C)
Every quarter, Claude analyses:
- Roles that have had 3+ hiring cycles in last 12 months (repeat hiring = probably attrition problem OR growth)
- Seasonal patterns (does Hagerstone hire more site supervisors in Oct-Nov before project season?)
- Outputs a "Q2 Hiring Forecast" report for Dhruv

---

## PART 4 — DB SCHEMA ADDITIONS SUMMARY

Run these in Supabase Dashboard → SQL Editor after current schema is live:

```sql
-- 1. Add Facebook/Instagram to portal support
-- (No schema change needed — portal_status is JSONB, just add keys)

-- 2. Call logs
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  called_by text NOT NULL,
  call_date timestamptz DEFAULT now(),
  call_status text NOT NULL CHECK (call_status IN ('connected','not_picked','callback_requested','rejected_on_call','moved_to_interview')),
  call_notes text,
  callback_time timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 3. Interviews
CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  interview_type text CHECK (interview_type IN ('hr','technical','director','final')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  mode text CHECK (mode IN ('in_person','google_meet','phone')),
  meet_link text,
  panel text[],
  venue text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','rescheduled','no_show')),
  feedback jsonb,
  outcome text CHECK (outcome IN ('pass','fail','hold')),
  created_at timestamptz DEFAULT now()
);

-- 4. References
CREATE TABLE public.references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  referee_name text NOT NULL,
  referee_designation text,
  referee_company text,
  referee_phone text,
  referee_email text,
  relationship text,
  reference_status text DEFAULT 'pending' CHECK (reference_status IN ('pending','contacted','completed','unreachable')),
  feedback_rating int CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_notes text,
  checked_by text,
  checked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 5. Offers
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id),
  job_id uuid REFERENCES public.jobs(id),
  ctc_gross_annual numeric NOT NULL,
  ctc_breakup jsonb,
  joining_date date,
  probation_months int DEFAULT 6,
  offer_letter_url text,
  esign_status text DEFAULT 'draft' CHECK (esign_status IN ('draft','sent','signed','declined')),
  offer_status text DEFAULT 'pending' CHECK (offer_status IN ('pending','accepted','negotiating','declined','withdrawn')),
  negotiation_notes text,
  created_at timestamptz DEFAULT now()
);

-- 6. Joinings
CREATE TABLE public.joinings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id),
  offer_id uuid REFERENCES public.offers(id),
  employee_id text,
  joining_date date NOT NULL,
  joining_location text,
  joining_type text CHECK (joining_type IN ('hq','site')),
  reporting_manager_email text,
  status text DEFAULT 'pre_joining',
  it_request_sent boolean DEFAULT false,
  finance_setup_done boolean DEFAULT false,
  kra_set boolean DEFAULT false,
  attendance_enrolled boolean DEFAULT false,
  induction_done boolean DEFAULT false,
  probation_end_date date,
  probation_reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 7. Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  joining_id uuid NOT NULL REFERENCES public.joinings(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text,
  file_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','submitted','verified','rejected','not_applicable')),
  verification_notes text,
  verified_by text,
  verified_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.joinings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow all (tighten with auth later)
CREATE POLICY "Allow all on call_logs" ON public.call_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on interviews" ON public.interviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on references" ON public.references FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on joinings" ON public.joinings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
```

---

## PART 5 — UPDATED KANBAN STAGES

Current: `new → screening → interview → offer → hired → rejected`

**Updated (to match your 8-stage pipeline):**

```javascript
export const STAGES = [
  "new",          // Application received
  "screening",    // AI screened, shortlisted
  "calling",      // HR phone screen scheduled/done
  "interview",    // Interview scheduled/done
  "reference",    // Reference check in progress
  "offer",        // Offer sent / negotiating
  "hired",        // Offer accepted, joining scheduled
  "onboarding",   // Joining in progress (documents, IT, finance)
  "rejected"
];
```

Update `STAGE_META` in `constants.js` with new colors for `calling`, `reference`, `onboarding`.

---

## PART 6 — SIDEBAR NAVIGATION (FINAL)

```
Dashboard          ⬛
Post a Job         ✦
All Jobs           ≡  [live count badge]
Applicants         ◎  [new badge]
📞 Calling Queue       [shortlisted pending call]
📅 Interviews          [today/tomorrow badge]
✅ Reference Check     [pending badge]
📝 Offer Letters       [draft badge]
🏠 Onboarding         [active joinings badge]
📄 Documents          [pending docs badge]
─────────────────
Resume Report      ☰
Analytics          📊
Questionnaire      ❓
```

---

## PART 7 — AGENTIC WORKFLOW INVENTORY

| ID | Name | Type | Stage | Trigger | Why this type |
|----|------|------|-------|---------|---------------|
| AG-01 | JD-Architect Agent | Claude | Stage 1 | User clicks Enhance JD | Generative text, portal variation |
| AG-02 | JobPosting-MetaAds-Flow | n8n deterministic | Stage 1 | Job saved with FB/IG portal | API call — no judgment needed |
| AG-03 | JobRepost-Reminder-Flow | n8n scheduled | Stage 1 | 7-day cron | Date arithmetic |
| AG-04 | EmailParser-Applicant-Flow | n8n deterministic | Stage 2 | Gmail webhook | Structured parsing |
| AG-05 | WhatsApp-Application-Bot | n8n + Maytapi | Stage 2 | Maytapi file webhook | Routing + storage |
| AG-06 | Acknowledgement-Flow | n8n deterministic | Stage 2 | Supabase row insert | Fixed template send |
| AG-07 | CV-Parser + JD Match Scorer | Claude (OpenAI) | Stage 3 | Resume upload | Unstructured text → structured score |
| AG-08 | DuplicateCheck-Flow | Classic code | Stage 3 | Pre-upload | Email/phone exact match |
| AG-09 | CallPrep-Agent | Claude | Stage 4 | HR opens calling modal | Resume → calling intel (judgment) |
| AG-10 | CallbackReminder-Flow | n8n scheduled | Stage 4 | 30-min cron | Time-based trigger |
| AG-11 | CallRetry-Flow | n8n + Maytapi | Stage 4 | Not-picked event | Retry logic |
| AG-12 | InterviewSchedule-Flow | n8n + Google Calendar + Maytapi | Stage 5 | Interview created | Calendar + email + WhatsApp send |
| AG-13 | InterviewReschedule-Flow | n8n + Maytapi | Stage 5 | Reschedule trigger | Slot change propagation |
| AG-14 | Feedback-Synthesizer-Agent | Claude | Stage 5 | All panel feedback in | Multi-person → consensus synthesis |
| AG-15 | Reference-Collector-Flow | n8n + Maytapi | Stage 6 | Stage moves to offer | WhatsApp collection |
| AG-16 | Reference-Summary-Agent | Claude | Stage 6 | Both refs completed | Qualitative notes → verdict |
| AG-17 | BGV-Trigger-Flow | n8n + AuthBridge API | Stage 6 | Senior role offer | Third-party API call |
| AG-18 | OfferLetter-Generator | Claude + deterministic CTC code | Stage 7 | HR inputs CTC | Template + personalised para |
| AG-19 | Onboarding-Orchestrator | Claude + Tools | Stage 7 | Offer accepted | Multi-track, branching by role/location |
| AG-20 | ProbationReminder-Flow | n8n scheduled | Stage 7 | Daily cron | Date arithmetic |
| AG-21 | DocCollection-WhatsApp-Bot | n8n + Maytapi | Stage 8 | Joining created | File routing — deterministic |
| AG-22 | Document-Validator-Agent | Claude Vision | Stage 8 | Document received | OCR + name match + quality check |
| AG-23 | DocReminder-Flow | n8n scheduled | Stage 8 | 2-day cron | Pending docs reminder |
| AG-24 | Reject-Letter-Personalizer | Claude | All stages | Stage rejection | Personalised kind rejection |
| AG-25 | CandidateStatus-Bot | n8n + Maytapi | All stages | WhatsApp "status?" | DB lookup — no AI needed |
| AG-26 | Analytics-Dashboard-Queries | Classic code (Supabase) | Dashboard | Page load | SQL aggregates — never AI |

---

## PART 8 — THE DECISION RULE (WHY AI WHERE)

Always ask in this order before proposing any agent:

**1. Is this financial, compliance, or statutory?** (payroll, CTC computation, PF, TDS)
→ Classic deterministic code only. NEVER AI. Errors here cost money + legal exposure.

**2. Is this date arithmetic, API call, or fixed template send?**
→ n8n deterministic flow. Cheaper, faster, debuggable.

**3. Is this unstructured text → structured output, or multi-person synthesis?**
→ Claude agent (text or vision).

**4. Is this stateful orchestration where branching explodes by case?**
→ Claude hybrid agent calling deterministic tools.

**5. Does a vendor already solve this for ₹X/month with compliance?**
→ Use the vendor (AuthBridge for BGV, Leegality for eSign, Setu for bank verification).

**Where we explicitly chose NOT to use AI in this system:**
- CTC breakup computation → deterministic formula
- Payroll → external HRMS (not built here)
- Statutory compliance (PF/ESI/TDS) → NOT built here, integrate with Keka/Darwin/GreytHR
- Leave approval → manager decision, not AI
- Interview scheduling (slot selection) → HR decision, n8n handles calendar mechanics
- Job portal API calls → n8n, not Claude
- Document routing (phone → joining → storage path) → n8n, not Claude

---

## PART 9 — PHASED ROLLOUT PLAN

### Phase A — Posting to Calling Queue (3 weeks) — P0 Priority

**Scope:**
- Add `calling` stage to Kanban
- Build `call_logs` table + migration
- Build Calling Queue panel in HireFlow
- Integrate Maytapi for candidate WhatsApp acknowledgement
- Build CallPrep Agent (Claude → calling intel from resume)
- Build CallbackReminder-Flow (n8n)
- Add Facebook/Instagram portals to PostJob form
- Build n8n Meta Ads flow

**Success signal for Dhruv:** HR can manage 20+ calling leads in the system without WhatsApp groups. Callback zero miss-rate.

**Owner:** Shubh (frontend + Claude agent), Aniket (n8n flows + Maytapi setup)

**External costs:** Maytapi ~₹3,000/month, Meta Ads budget (HR sets per campaign)

---

### Phase B — Interview to Offer (3 weeks after Phase A)

**Scope:**
- Build `interviews` table + migration
- Build Interview Scheduler UI in applicant modal
- Build `InterviewSchedule-Flow` (n8n + Google Calendar + Maytapi)
- Build Feedback Collector (panel feedback form)
- Build Feedback-Synthesizer Agent (Claude)
- Build `references` table + Reference Check UI
- Build Reference-Collector-Flow (n8n + Maytapi)
- Build Reference-Summary Agent (Claude)
- Build `offers` table + Offer Letter Generator (Claude + CTC code)

**Success signal:** HR can schedule, track, and close interviews without any external spreadsheet. Offer letters generated in < 5 minutes.

**Owner:** Shubh + Aniket jointly

---

### Phase C — Onboarding + Documents (4 weeks after Phase B)

**Scope:**
- Build `joinings` + `documents` tables
- Build Onboarding panel in HireFlow
- Build Onboarding-Orchestrator Agent (Claude + Supabase MCP + Maytapi)
- Build Document Collection WhatsApp Bot (n8n + Maytapi)
- Build Document-Validator Agent (Claude Vision)
- Build DocReminder-Flow + ProbationReminder-Flow (n8n)
- Build updated Analytics Dashboard
- Build Talent Pool feature

**Success signal:** A new joiner can complete all 8 documents via WhatsApp without calling HR. Probation end never missed.

---

### Total External Tooling Budget (Monthly)

| Tool | Purpose | Est. Cost/month |
|------|---------|-----------------|
| Maytapi | WhatsApp automation | ~₹3,000 |
| Leegality / eMudhra | eSign for offer letters | ~₹50–100/sign |
| AuthBridge BGV | Background verification | ~₹800–2000/check (senior hires only) |
| Setu / Razorpay | Bank account verification | ~₹15–25/check |
| Meta Ads | Facebook/Instagram job ads | HR-determined per campaign |
| Google Calendar API | Interview scheduling | Free |
| Claude API (Anthropic) | All AI agents | ~₹2,000–8,000/month (scales with hiring volume) |
| **Total base (excl. Ads)** | | **~₹8,000–15,000/month** |

**Context:** A recruiter spending 30% of their time on screening + scheduling = ₹15,000/month of recoverable time. This system pays for itself at current scale.

---

## PART 10 — UI/UX DESIGN PRINCIPLES FOR THE FULL SYSTEM

### The Feel We're Going For
The system should feel like **AI is running in the background and surfacing the right thing at the right time.** Not a form-heavy HR system. Not a CRM. More like a control room where AI does the heavy lifting and HR makes the calls.

### Key UX Patterns

**1. Zero-Inbox Principle for HR**
Every panel should have a clear "action required" count. When everything is done, it shows zero. HR's job is to get everything to zero.

**2. AI Actions Are Always Visible**
Every AI-generated content (screening note, call prep card, rejection letter) shows a small "✦ AI" tag. HR always knows what was AI vs human.

**3. One-Click Actions**
"Send reminder" should be one click, not a form. "Log call outcome" should be a dropdown, not a paragraph. HR time is expensive.

**4. Progressive Disclosure**
Dashboard shows summary. Click to go deeper. Never show a wall of data upfront.

**5. Mobile-First for Site Roles**
Site supervisors join on Sunday with a phone. The document upload WhatsApp bot is the mobile-first flow — no app download required.

**6. Agent Status Visibility**
When Onboarding Orchestrator is running for a joiner, show a small "🤖 AI running" indicator with a log of what it last did. HR should never wonder "is the system doing something?"

### Color System for Stages
```
New:         Indigo  #6366f1  (cool, neutral)
Screening:   Amber   #f59e0b  (warm, attention)
Calling:     Sky     #0ea5e9  (active, in progress)
Interview:   Purple  #8b5cf6  (elevated, important)
Reference:   Orange  #f97316  (critical check)
Offer:       Green   #22c55e  (positive, near close)
Hired:       Emerald #10b981  (success)
Onboarding:  Teal    #14b8a6  (transition, becoming part of team)
Rejected:    Red     #ef4444  (closed)
```

---

## PART 11 — THINGS TO EXPLICITLY NOT BUILD (ANTI-PATTERNS)

These are common asks that would hurt the system:

| Request | Why NOT to build |
|---------|-----------------|
| "AI should auto-reject below score X" | Do not auto-reject without HR review. AI scores are directional, not definitive. Use as filter, not gatekeeper. |
| "AI decides the offer CTC" | CTC is a budget + grade + market call. Human decision always. Code computes the breakup. |
| "Let AI approve leave" | Leave approval is a manager's authority. Show balance + policy — let manager decide. |
| "Post to LinkedIn directly without HR review" | Posting copy and frequency need a human gate. Agent drafts, HR approves. |
| "Payroll computation in this system" | Use a dedicated HRMS (Keka, GreytHR). Payroll math with PF/ESI/TDS rate changes is too compliance-sensitive for a custom build. |
| "Auto-reply to all candidate WhatsApps" | Status queries: yes, automate. Negotiation, salary discussions, joining condition changes: always escalate to HR. |
| "Build BGV in-house" | Use AuthBridge/IDfy. They have the API, compliance, and legal indemnification. Don't build what vendors do better. |

---

## QUICK REFERENCE — FILE CHANGES NEEDED IN REPO

| File | Change |
|------|--------|
| `src/constants.js` | Add `calling, reference, onboarding` to STAGES; add STAGE_META for them; add Facebook/Instagram to PORTALS |
| `src/context/AppContext.jsx` | Add state for `callLogs, interviews, references, offers, joinings, documents`; add fetch calls |
| `src/components/layout/Sidebar.jsx` | Add 6 new nav items: Calling Queue, Interviews, Reference Check, Offer Letters, Onboarding, Documents |
| `src/services/` | Add `callService.js`, `interviewService.js`, `referenceService.js`, `offerService.js`, `joiningService.js`, `documentService.js` |
| `src/components/panels/` | Add `CallingQueue.jsx`, `Interviews.jsx`, `ReferenceCheck.jsx`, `OfferLetters.jsx`, `Onboarding.jsx`, `Documents.jsx` |
| `src/services/aiService.js` | Add `generateCallPrep()`, `generateRejectionLetter()`, `validateDocument()`, `synthesizeFeedback()`, `summarizeReference()` |
| `supabase/functions/` | Add `call-prep`, `validate-document`, `synthesize-feedback`, `generate-offer-letter`, `summarize-reference` Edge Functions |
| `supabase/schema.sql` | Add 6 new tables (see Part 4) |
| n8n (separate) | Create 15+ flows listed in Agent Inventory (Part 7) |

---

*Document prepared by: AI Solution Architect | HireFlow v2.0 Upgrade Plan*
*Next step: Dhruv review → Phase A kickoff with Shubh + Aniket*
