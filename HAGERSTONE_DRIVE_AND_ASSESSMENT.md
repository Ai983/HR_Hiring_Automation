# Hagerstone Mass Interview Drive — Complete Reference & Assessment System

**Master document for the hiring system**
Version 1.0 · 18 August 2026

---

## 0. PURPOSE OF THIS DOCUMENT

This is the single reference for the Hagerstone Mass Interview Drive held on
**Saturday, 22 August 2026**, and for the first-level screening assessment used at
that drive.

It exists so that:
1. The walk-in day can be run consistently by anyone on the HR team.
2. The paper assessment can be **digitised into the hiring system** without rewriting
   the question bank or re-deriving the scoring logic.
3. A future drive can be run by copying this document and changing the dates.

**Read §9 before building anything.** There are open items that affect the role list
and the assessment content, and they are not yet resolved.

---

## 1. DRIVE FACTS — LOCKED, USE VERBATIM

```
Company:        Hagerstone International Pvt. Ltd.
Event:          Mass Interview Drive (walk-in)
Date:           Saturday, 22 August 2026
Time:           10:00 AM – 5:00 PM
Venue:          91Springboard, D-107, Sector 2, Noida 201301
Nearest Metro:  Sector 15
Careers email:  careers@hagerstone.com
Office bases:   Noida / Gurugram
Site locations: Pan-India
Timezone:       Asia/Kolkata (IST)
```

**Business verticals advertised:** Commercial Interior · Luxury Interior ·
Civil Construction · PEB Projects · Aluminium Doors & Windows · Building Metal Façade

**Candidate instructions (used on every channel):**
Carry a printed CV, photo ID (Aadhaar / PAN / Driving Licence), and one passport-size
photograph. No appointment needed — walk in any time between 10 AM and 5 PM.

---

## 2. ROLES & DEPARTMENTS

### 2.1 The 4 departments

```
Site Team
Interiors
Fabrication / Factory Operations
Procurement & Sales
```

### 2.2 The 13 positions — exact spelling

| # | Position | Department |
|---|----------|------------|
| 1 | Project Manager | Site Team |
| 2 | Site Engineer | Site Team |
| 3 | Site Supervisor | Site Team |
| 4 | Civil Engineer | Site Team |
| 5 | MEP Engineer | Site Team |
| 6 | Interior Designer | Interiors |
| 7 | Architect | Interiors |
| 8 | Façade Factory Manager | Fabrication / Factory Operations |
| 9 | Factory Operations | Fabrication / Factory Operations |
| 10 | Procurement | Procurement & Sales |
| 11 | Sales Manager | Procurement & Sales |
| 12 | Sales Executive | Procurement & Sales |
| 13 | Documentation Controller | Procurement & Sales |

> Note the cedilla in **Façade**. It URL-encodes as `Fa%C3%A7ade`. Do not normalise it
> to "Facade" anywhere — the form dropdown value and the pre-filled ad links depend on
> the exact string matching.

### 2.3 Role specialisations shown on creative

- **Project Manager** — Interior · Façade · Construction
- **Façade Factory Manager** — Aluminium Doors & Windows

---

## 3. APPLICATION FUNNEL

```
Meta carousel ad  ┐
Indeed listing    ├──→  Google Form  ──→  Google Sheet  ──→  HR calling list
LinkedIn / IG     │                              │
WhatsApp / Status ┘                              └──→  WhatsApp M1–M4 messages
                                                              │
                                        Walk-in on 22 Aug  ←──┘
                                                  │
                                    ┌─────────────┴─────────────┐
                                    │  ASSESSMENT (this doc §5) │
                                    └─────────────┬─────────────┘
                                                  │
                                        Technical interview
                                                  │
                                          Offer / Reject
```

### 3.1 Google Form

- **Public link:** `https://docs.google.com/forms/d/e/1FAIpQLSc7lA7q_cG9qnMjAuuoesIj8UPIkwkkTdNISpAWiko26GWmyA/viewform`
- **Owner:** ai@hagerstone.com (Workspace: Hagerstone Int. Pvt. Ltd.)
- **Response Sheet:** `https://docs.google.com/spreadsheets/d/1Z_DtrVdHEuofHSoG5MfMEz9zgTZxlKWT0I8DqqVsV2k/edit`

**Form fields captured:** Full Name · Mobile · Department · Position · Experience ·
Current Company · Current Designation · Current City · Notice Period ·
Pan-India willingness · Preferred office · CV upload · Can attend on 22 Aug

**Deliberately NOT asked on the form:** Current CTC and Expected CTC.
Meta's Advertising Standards prohibit ads requesting income information, and a prior
ad on this account was rejected. **CTC is asked on the HR phone call instead.**
Do not add salary fields to any form linked from a Meta ad.

### 3.2 ⚠️ Known conversion problem — unresolved as of 18 Aug

| Metric | Value |
|--------|-------|
| Link clicks | 341 |
| Form submissions | 5 |
| Conversion | **1.5%** |
| Spend | ₹224.62 |
| Cost per submission | ₹44.92 |

Expected conversion for a job application form is 10–30%. The ad is performing well
(₹0.66 per link click); the loss is on the form.

**Ruled out:** Workspace domain restriction — submissions from multiple personal Gmail
addresses confirm the form is publicly reachable.

**Prime suspects, not yet confirmed:**
1. **CV file upload on mobile.** A candidate scrolling Facebook does not have a CV on
   their phone. This is likely the single biggest drop-off.
2. **Forced Google sign-in.** Triggered by both "Collect email = Verified" and the file
   upload question. Google sign-in is unreliable inside the Facebook in-app browser.

**Diagnostic still to run:** add **Landing Page Views** as a column in Ads Manager and
compare against Link Clicks. A gap of 30–40% is normal; 90% means people are not even
reaching the form.

**Recommended fix (applies to future drives regardless):** remove the CV upload question
and set email collection to a plain short-answer field. The form becomes fully anonymous
and submits in any browser. Nothing is lost operationally — every channel already tells
candidates to bring a printed CV to the venue.

---

## 4. WALK-IN DAY FLOW

```
1. ARRIVAL      → Candidate signs the register, states position applied for
2. VERIFY       → Check photo ID; confirm they appear in the response Sheet
                  (walk-ins without prior registration are allowed — register on the spot)
3. ASSESSMENT   → Send them to /test.html on their phone. They enter their email
                  and name, and sit the 20-question paper (§5.4). 25 min. Invigilated.
                  COLLECT PHONES — the paper is not AI-proof (§5.4).
                  If the Wi-Fi is down, issue the printed 13-question paper (§5.0).
4. MARK         → Online: marked automatically, score on screen at submit, and in
                  the Assessment panel. Paper: evaluator marks against the key.
5. ROUTE        → Score band (§6) decides queue priority, NOT accept/reject
6. INTERVIEW    → Technical panel by department
7. OUTCOME      → Recorded against the candidate in the hiring system
```

**Assessment is a queue-prioritisation tool, not a gate.** See §6.3.

---

## 5. THE ASSESSMENT — QUESTION BANK

> **Read this before using any version.**
>
> | | `HAG-WALKIN-L1-v1` | `HAG-WALKIN-L1-v4` |
> |---|---|---|
> | Format | 13 questions · 15 min | **20 questions · 25 min** |
> | Tests | Arithmetic, reasoning, site vocabulary | **Situational judgement, procedure, client handling** |
> | Sections | A 5 · B 3 · C 5 | A 4 · B 5 · C 5 · D 3 · E 3 |
> | Delivery | Printed paper, hand-marked | **Online, auto-marked** |
> | Where | §5.0 below | §5.4 below |
> | Use it for | Wi-Fi failure fallback | **The 22 Aug drive** |
>
> **v4 is the paper the drive runs on.** v1 is retained verbatim as the offline
> fallback required by §7.3 — if the venue Wi-Fi dies, HR issues the printed
> sheet and the day continues. Scores across versions are not comparable;
> `assessment_id` on the attempt records which paper a candidate sat.
>
> **`HAG-WALKIN-L1-v2`** (20 questions) was the first online paper and is
> superseded. It was replaced before the drive because it mostly tested whether
> a candidate had read a glossary, not whether they could run a site. Its
> attempts remain readable and re-markable; do not reuse the id.

### 5.0 v1 — the printed fallback paper

**Format:** 13 multiple-choice questions · 1 mark each · 13 marks total · 15 minutes
**Rules:** No negative marking. One option per question. No calculators or phones.
**Sections:** A — Numerical Aptitude (5) · B — Logical Reasoning (3) · C — General
Industry Awareness (5)

**Design intent:** Every one of the 13 positions must be able to sit the same paper.
It tests basic numeracy, everyday reasoning, and general site vocabulary. It is
deliberately easy and contains **no role-specific technical content**.

### 5.1 Machine-readable question bank

```json
{
  "assessment_id": "HAG-WALKIN-L1-v1",
  "title": "First-Level Assessment",
  "total_questions": 13,
  "total_marks": 13,
  "duration_minutes": 15,
  "negative_marking": false,
  "sections": [
    { "id": "A", "name": "Numerical Aptitude",        "questions": [1,2,3,4,5] },
    { "id": "B", "name": "Logical Reasoning",         "questions": [6,7,8] },
    { "id": "C", "name": "General Industry Awareness","questions": [9,10,11,12,13] }
  ],
  "questions": [
    {
      "n": 1, "section": "A",
      "q": "A room measures 12 feet by 10 feet. What is the floor area?",
      "options": ["100 sq ft", "110 sq ft", "120 sq ft", "140 sq ft"],
      "answer": "C",
      "explanation": "12 × 10 = 120 sq ft."
    },
    {
      "n": 2, "section": "A",
      "q": "Material cost is ₹80,000. Labour is 25% of the material cost. What is the total cost?",
      "options": ["₹85,000", "₹95,000", "₹1,00,000", "₹1,05,000"],
      "answer": "C",
      "explanation": "Labour = 25% of 80,000 = 20,000. Total = ₹1,00,000."
    },
    {
      "n": 3, "section": "A",
      "q": "A wall is 10 m long and 3 m high. What area needs painting?",
      "options": ["13 sq m", "30 sq m", "33 sq m", "60 sq m"],
      "answer": "B",
      "explanation": "Area = length × height = 10 × 3 = 30 sq m."
    },
    {
      "n": 4, "section": "A",
      "q": "An item costs ₹1,200. With 18% GST, what is the final amount?",
      "options": ["₹1,368", "₹1,416", "₹1,440", "₹1,516"],
      "answer": "B",
      "explanation": "GST = 18% of 1,200 = 216. Total = ₹1,416."
    },
    {
      "n": 5, "section": "A",
      "q": "If 1 metre is approximately 3.28 feet, roughly how many feet are in 5 metres?",
      "options": ["12.4 ft", "14.8 ft", "16.4 ft", "18.2 ft"],
      "answer": "C",
      "explanation": "5 × 3.28 = 16.4 feet."
    },
    {
      "n": 6, "section": "B",
      "q": "Which one does NOT belong with the others?",
      "options": ["Hammer", "Screwdriver", "Cement", "Pliers"],
      "answer": "C",
      "explanation": "Cement is a material. The other three are hand tools."
    },
    {
      "n": 7, "section": "B",
      "q": "Complete the series: 5, 10, 20, 40, ___",
      "options": ["50", "60", "80", "100"],
      "answer": "C",
      "explanation": "Each number doubles. 40 × 2 = 80."
    },
    {
      "n": 8, "section": "B",
      "q": "Put these site activities in the correct order of execution:",
      "options": [
        "Painting → Plastering → Brickwork → Flooring",
        "Brickwork → Plastering → Flooring → Painting",
        "Flooring → Brickwork → Painting → Plastering",
        "Plastering → Brickwork → Painting → Flooring"
      ],
      "answer": "B",
      "explanation": "Structure first, finishes last: Brickwork → Plastering → Flooring → Painting."
    },
    {
      "n": 9, "section": "C",
      "q": "In construction, what does BOQ stand for?",
      "options": ["Board of Quality", "Bill of Quantities", "Basic Order Quotation", "Builder's Operating Quote"],
      "answer": "B",
      "explanation": "BOQ = Bill of Quantities, the itemised list of materials and work with quantities."
    },
    {
      "n": 10, "section": "C",
      "q": "What does MEP refer to in a building project?",
      "options": [
        "Material, Equipment, Personnel",
        "Measurement, Estimation, Planning",
        "Mechanical, Electrical, Plumbing",
        "Manpower, Engineering, Procurement"
      ],
      "answer": "C",
      "explanation": "MEP = Mechanical, Electrical and Plumbing services."
    },
    {
      "n": 11, "section": "C",
      "q": "What does PPE stand for on a construction site?",
      "options": [
        "Personal Protective Equipment",
        "Project Planning Estimate",
        "Primary Power Extension",
        "Public Property Entry"
      ],
      "answer": "A",
      "explanation": "PPE = Personal Protective Equipment — helmet, safety shoes, gloves, harness."
    },
    {
      "n": 12, "section": "C",
      "q": "What is the main purpose of a false ceiling in an office interior?",
      "options": [
        "To increase the room height",
        "To conceal ducts, wiring and pipes",
        "To support the floor above",
        "To reduce the cost of flooring"
      ],
      "answer": "B",
      "explanation": "A false ceiling hides MEP services and improves the finish."
    },
    {
      "n": 13, "section": "C",
      "q": "Which drawing shows the top view or layout of a floor?",
      "options": ["Elevation", "Section", "Floor plan", "Isometric"],
      "answer": "C",
      "explanation": "A floor plan is the top view showing the layout of rooms and spaces."
    }
  ]
}
```

### 5.2 Answer key — quick reference

| Q | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|---|----|----|----|----|
| **Ans** | C | C | B | B | C | C | C | B | B | C | A | B | C |

### 5.4 v4 — the live online paper (`HAG-WALKIN-L1-v4`)

**Format:** 20 MCQs · 1 mark each · 20 marks · 25 minutes · no negative marking

| Section | Name | Q | Marks |
|---|---|---|---|
| A | Site Execution & Sequencing | 1–4 | 4 |
| B | Client & Stakeholder Handling | 5–9 | 5 |
| C | Procedure & Documentation | 10–14 | 5 |
| D | Commercial Judgement | 15–17 | 3 |
| E | Safety & Problem Diagnosis | 18–20 | 3 |

**Every question is a short situation.** The candidate is asked what they would
**do**, what procedure they would follow, or how they would handle a client. The
register is plain and the wrong options are clearly wrong — do nothing, hide it,
cut the corner, blame someone.

The three Section D questions are numerical but single-step, and the arithmetic
sits inside a commercial situation (extra work at an agreed rate, a two-vendor
comparison, a cement reconciliation) rather than being asked bare.

**⚠️ v4 is easier than v3 by design, and that costs discrimination.** An easy
paper clusters scores near the top, and a score everybody gets 17+ on cannot
decide who the panel sees first — which is the only thing this score is for
(§6.3). **If the spread on the day is too tight, re-cut the bands** in
`bandFor()` against real attempt data. Bands can change freely; questions cannot
once they have been sat (§7.4).

**⚠️ It is not AI-proof, and cannot be made so.** A language model answers
situational-judgement questions very well — easier questions, if anything, more
easily. **Invigilation — phones collected at the desk — is the control.**

**No role-specific technical content** (§7.5). All 13 positions sit the same
paper; every answer turns on judgement or basic procedure, not trade knowledge.

**Canonical source of the questions and the key:**
`supabase/functions/_shared/assessment-bank.ts`. That file is **server-only** —
imported by the `assessment` edge function, never bundled into a browser. Do not
copy the answers into any client-side file.

**Printed answer key:** `npm run assessment:pdf` regenerates
`Hagerstone_Walkin_Assessment_v4_20Q_ANSWER_KEY.pdf` from that module — every
question, the correct option, the reasoning, the key table and the bands are
derived, so the sheet cannot drift from the live test. **Evaluator only.** Note
that the A/B/C/D letters in it are the canonical order; the online test shuffles
options per candidate, so match by option text, not by letter.

**Where candidates sit it:** `https://hr-hiring-automation.vercel.app/test.html`
No login. The candidate types an email address and their full name; the email is
the key that separates one person's answers and score from another's. See §7.

**Superseded versions — do not reuse these ids.** v2 (20 Q) tested arithmetic and
site vocabulary. v3 (25 Q, 35 min) was situational but judged too hard and too
slow for a walk-in queue. Their attempts stay readable and re-markable.

### 5.5 v1 printed paper

A print-ready PDF exists: `Hagerstone_Walkin_Assessment_13Q.pdf`
- Page 1 — question paper (single sheet, issue to candidate)
- Pages 2–3 — answer key and evaluation notes (**evaluator only, never issue**)

Header fields on the paper: Candidate Name · Position Applied For · Mobile Number.
Footer: candidate declaration + signature, date, invigilator signature.

---

## 6. SCORING

### 6.1 Bands

**v4 — 20 marks (the live online paper):**

| Score | % | Band | Action |
|-------|---|------|--------|
| 17–20 | 85%+ | STRONG | Shortlist — send to technical panel first |
| 12–16 | 60%+ | AVERAGE | Proceed to interview normally |
| 8–11 | 40%+ | WEAK | Judge by role and experience |
| 0–7 | <40% | BELOW_BAR | Interview only if experience is strong |

**v1 — 13 marks (the printed fallback):**

| Score | Band | Action |
|-------|------|--------|
| 11–13 | Strong | Shortlist — send to technical panel first |
| 8–10 | Average | Proceed to interview normally |
| 5–7 | Weak | Judge by role and experience |
| 0–4 | Below bar | Interview only if experience is strong |

The v4 cuts are the v1 cuts rescaled to the same percentages, so a STRONG on
any version means roughly the same thing. `assessment_id` on the attempt records
which paper was sat.

### 6.2 Section-level reading

Worth recording section scores separately, not just the total. v4 stores all
five; the Assessment panel shows them per candidate. What each pattern means:

- **B low (Client & Stakeholder Handling)** → will need supervision in front of a
  client. Fine for a Site Supervisor or Factory Operations; a real concern for a
  Project Manager, Sales Manager or Architect who fronts the client themselves.
- **C low (Procedure & Documentation)** → gets work done but leaves no paper
  trail. This is the profile that loses variation claims and fails audits.
  Disqualifying-ish for a Documentation Controller or Procurement; coachable in a
  Site Engineer.
- **D low (Commercial Judgement)** → cannot reason about money on a project.
  A concern for Procurement, Sales and Project Manager; largely irrelevant for a
  Site Supervisor.
- **E low (Safety & Problem Diagnosis)** → probe this at interview regardless of
  role. Q22 (stopping another agency's unsafe act) and Q14 (near-miss reporting)
  are the two worth asking about directly.
- **A high, everything else low** → practical and quick on site, weak on process
  and people. Common in experienced supervisors and often perfectly hireable.

A candidate strong on A/D but weak on B/C is a doer who will cost you at
closeout. A candidate strong on B/C but weak on A has never actually run a floor.
Neither is a reject — both are a specific question to ask the panel to probe.

### 6.3 ⚠️ How this score must NOT be used

**This is a queue-prioritisation tool, not a hiring gate.**

An experienced Site Supervisor with limited formal schooling may score 5/13 and still be
exactly the right hire. A polished graduate may score 13/13 and be unable to run a site.

Rules:
- A low score must **never** auto-reject a candidate with strong relevant experience.
- A high score does **not** substitute for the technical interview.
- On a busy walk-in day, use the score to decide **who the panel sees first**, so the
  strongest candidates are not lost to a long queue.

If the hiring system implements auto-filtering on this score, it will reject good site
staff. Build it as a sort order, not a filter.

---

## 7. THE ONLINE ASSESSMENT — AS BUILT

The digital version described in earlier revisions of this section is now built and
running `HAG-WALKIN-L1-v2`. This section documents what exists.

### 7.0 The pieces

| Piece | Path | What it is |
|-------|------|-----------|
| Candidate page | `test.html` → `src/components/assessment/AssessmentPortal.jsx` | Public, no login. A third Vite entry alongside `index.html` and `attend.html`. |
| Candidate API client | `src/services/assessmentApi.js` | Talks only to the edge function. Never queries a table. |
| Server | `supabase/functions/assessment/index.ts` | Actions `start` and `submit`. Service-role key. |
| Question bank + key | `supabase/functions/_shared/assessment-bank.ts` | **Server-only.** Never bundled into a browser. |
| Table | `hr.assessment_attempts` | `supabase/migrations/20260819120000_hr_walkin_assessment_attempts.sql` |
| HR panel | `src/components/panels/AssessmentResults.jsx` + `src/services/assessmentService.js` | Sidebar → Onboarding → Assessment |

### 7.1 How a candidate is identified — and why there is no login

Candidates are walk-ins with no Hub account, and there is no time to create one at
the door. The start screen asks for an **email address and a full name**. The
email, lowercased and trimmed, is the key: it is what ties an attempt, its
answers and its score to one person and separates them from everyone else.

That makes the candidate's browser **anonymous**, which drives the whole
security shape:

- `hr.assessment_attempts` has **RLS on, no `anon` policy and no `anon` grant.**
  `rls-hardening-golive.sql` exists because `anon` could once read `hr.applicants`
  and even INSERT into it. Nothing here reopens that.
- Every candidate-side read and write goes through the **`assessment` edge
  function on the service-role key** — the same shape as `attendance-punch`.
- **The answer key never reaches a browser.** Questions are served with `answer`
  and `explanation` stripped; marking happens on the server.

The browser is trusted for nothing that matters: `attempt_token` is issued
server-side, `ends_at` is computed from the server's `started_at`, and the score
is computed from the server's key.

### 7.2 Data model

`hr.assessment_attempts` — see the migration for the authoritative column list.
Beyond the fields specified in the original design, three exist for reasons worth
knowing:

- **`presented`** — the option order this candidate actually saw. Options are
  shuffled within each question (people sit shoulder to shoulder in a walk-in
  hall); question order is fixed so the sections stay meaningful and the printed
  paper matches. `presented` is what makes §7.4 hold.
- **`review`** — the marked paper, snapshotted at submit: question text, what
  they chose, what was correct, and why. It exists so the HR panel can show a
  reviewed attempt **without the answer key ever being shipped into a browser
  bundle**, and so an attempt stays reviewable after v3 is minted.
- **`retake_unlocked` / `unlocked_by` / `unlocked_at`** — the HR-unlock flow in §7.3.

### 7.3 Behaviour as implemented

| Requirement | What it does |
|-------------|--------------|
| Question order | Fixed — sections are meaningful and the paper version must match. |
| Option order | Shuffled within each question. The presented order is stored on the attempt. |
| Timer | 25 minutes, visible, counted against the **server's** `ends_at` (client clocks on borrowed phones are not trustworthy). Auto-submits on expiry. |
| Navigation | Back/forward, plus a 20-cell palette showing what is answered. No penalty for changing an answer. |
| Partial submit | Whatever is answered is scored; unanswered = 0. No negative marking. Past the timer the paper is still marked and flagged `auto_submitted` — a candidate never loses their work to a slow phone. |
| Resume | An attempt in progress resumes on the **same** token, paper and remaining time. A refresh, a dead battery or a dropped connection does not cost a fresh attempt or a fresh 25 minutes. Answers mirror to `localStorage` on every tap. |
| Retake | **One attempt per candidate per drive.** Re-opening with a used email shows the earlier score and directs them to the HR desk. HR clicks **Allow retake** in the Assessment panel to grant exactly one re-sit; the unlock is consumed by the next start, so it cannot become unlimited re-sits. |
| Device | Built for a low-end Android: one question per screen, 44px+ tap targets, 16px inputs, no hover-only cues. |
| Offline fallback | The printed v1 paper (§5.0, §5.5) stays in use. If the venue Wi-Fi fails, HR switches to paper without losing the day. |
| What the candidate sees | Total score out of 20 and the five section scores. **Not** the band, and **not** the correct answers — the band is an internal routing signal (§6.3), and printing the key on screen would leak the paper across the hall within an hour. |

### 7.4 Versioning

The `assessment_id` carries a version. **Never edit questions in place** — if a
question changes, mint `HAG-WALKIN-L1-v3` in `assessment-bank.ts`. Scores from
different versions are not comparable, and a stored attempt must always be
re-markable against the exact question set the candidate saw. `presented` and
`review` on the attempt row are what guarantee that.

### 7.5 Future question bank expansion

v3 replaced the aptitude-and-vocabulary paper entirely with a situational one.
Keep total time proportional — every v3 question carries a situation to read,
which is why 25 questions need 35 minutes rather than the ~1 minute per question
the earlier versions ran at. **Check throughput on the day:** 35 minutes per
candidate is a real constraint on a walk-in queue. If the hall backs up, run more
devices in parallel rather than cutting the time.

If a Section D answer turns out not to match how Hagerstone actually works, that
is a content fix, not a bug — change it in `assessment-bank.ts` and mint v4.

Do **not** add role-specific technical questions to this paper — all 13 positions
sit it. If department-level technical screening is wanted, build it as a
**separate second-level assessment** keyed to `department`, taken after the
first-level pass.

### 7.6 Deploying it

```
1. Apply supabase/migrations/20260819120000_hr_walkin_assessment_attempts.sql
   (dashboard SQL editor — see supabase/migrations/README.md)
2. supabase functions deploy assessment
3. Deploy the app. The candidate page is /test.html
```

No "Verify JWT" toggle is needed on the function: the page calls it with the
project anon key in the `Authorization` header, which is a valid project JWT —
the same call shape as `screen-resume`.

---

## 8. SUPPORTING ASSETS

| Asset | File / Location | Notes |
|-------|-----------------|-------|
| Carousel posters (14) | `Drive_22Aug_Card01..14_*.png` | 2160×2160, 1:1 |
| Online assessment | `/test.html` on the hiring app | v4 · 20 Q · live · see §7 |
| Question bank + key | `supabase/functions/_shared/assessment-bank.ts` | **Server-only. Never publish.** |
| Assessment paper (v1) | `Hagerstone_Walkin_Assessment_13Q.pdf` | 3 pages · Wi-Fi-failure fallback |
| Indeed listing | `Hagerstone_Indeed_Job_Posting.docx` | Ready to paste |
| WhatsApp messaging spec | `WHATSAPP_DRIVE_MESSAGING_SPEC.md` | M1–M4 build spec |
| Google Form | link in §3.1 | Live |
| Response Sheet | link in §3.1 | Live |

**Poster cards NOT used in the paid carousel** (Meta caps at 10) — available for organic
posting: Card04 Site Supervisor · Card08 Architect · Card10 Factory Operations ·
Card13 Sales Executive.

---

## 9. ⚠️ OPEN ITEMS — RESOLVE BEFORE THE NEXT DRIVE

These are unresolved as of 18 August 2026. Each affects the accuracy of this document.

### 9.1 Role list gaps

**PEB has no dedicated role.** "PEB Projects" is advertised as a vertical on every
poster and in the Indeed listing, but none of the 13 positions is PEB-specific. A PEB
Design Engineer or Erection Engineer who sees the ad will find no matching option in the
Position dropdown.

**Quality, Dispatch and Furniture** were named as teams in the founder's brief but do not
appear in the 13 positions, the form, or any creative.

→ Confirm with the founder whether these are genuinely open roles. If yes, the form
dropdown, the posters and §2.2 of this document all need updating.

### 9.2 Department count

The form uses **4 departments**. The founder's original brief described **6 divisions**
(Project, Civil Construction, Interiors, MEP, Fabrication/Factory Ops, Procurement &
Sales). The collapse to 4 was a simplification for candidates and has not been formally
confirmed.

### 9.3 Content requiring HR sign-off

Two pieces of content were drafted from general industry knowledge, **not** from
Hagerstone job descriptions:

1. **The 52 responsibility bullet points** on the 13 role posters (4 per role).
2. **The assessment questions** in §5. This matters far more for v3 than it did
   for v1: almost every v3 answer is a claim about *how Hagerstone expects its
   people to behave*, not a fact. "What does BOQ stand for" cannot be wrong for
   Hagerstone specifically. "Confirm the client's verbal change in writing before
   starting", "escalate before suspending work for non-payment", and "hold the
   column and refer a 12 mm bolt deviation to the designer" all can be — and a
   candidate can hold you to any of them at interview.

   **Highest priority to review, in order:** Q6 and Q10 (client change requests
   and non-payment — both describe your commercial process), Q12 (whose
   instruction your team may act on), Q2 (structural escalation threshold),
   Q13 (GRN and rejection practice). Fifteen minutes with someone who runs sites
   and someone who runs procurement covers all five.

Neither has been reviewed by HR or department heads. Two specific items to verify:
- Civil Engineer poster states *"Ensure quality as per IS standards"* — confirm
  Hagerstone works to IS codes on these projects.
- Sales Executive poster states *"Maintain CRM and pipeline records"* — confirm a CRM
  is actually in use for this team.

These are public claims about the job that a candidate can hold you to at interview.

### 9.4 Form conversion

See §3.2. Unresolved and actively costing applications. The Landing Page Views
diagnostic has not yet been run.

---

## 10. RUNNING THIS AGAIN

To reuse this document for a future drive:

1. Update §1 (date, time, venue) — these strings appear in the form description, the
   posters, the Indeed listing and all four WhatsApp templates.
2. Re-check §2 against the live vacancy list. Do not assume the 13 roles still apply.
3. Resolve every item in §9 before the creative is produced, not after.
4. Reuse the assessment as-is (§5) unless HR has revised it — in which case mint a new
   `assessment_id` version per §7.3.
5. Build the form **without** a file upload question and **without** verified email
   collection, per §3.2.

---

*End of document.*
