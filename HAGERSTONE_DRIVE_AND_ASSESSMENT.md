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
3. ASSESSMENT   → LEVEL 1: send them to /test.html on their phone. They enter
   (level 1)      their email and name, and sit the 15-question paper (§5.4).
                  15 min. Invigilated. COLLECT PHONES — not AI-proof (§5.4).
                  If the Wi-Fi is down, issue the printed 13-question paper (§5.0).
4. ASSESSMENT   → LEVEL 2: same phone, /test2.html. Same email and name, plus the
   (level 2)      POSITION they applied for — that is what selects their paper.
                  12 questions on their own role, 15 min (§7.7). Same invigilation.
                  No printed fallback exists for level 2: if the Wi-Fi is down,
                  skip it and run the technical interview as before.
5. MARK         → Online: both papers marked automatically, score on screen at
                  submit, and in the Assessment panel. Paper: marked against the key.
6. ROUTE        → Score bands (§6) decide queue priority, NOT accept/reject
7. INTERVIEW    → Technical panel by department
8. OUTCOME      → Recorded against the candidate in the hiring system
```

**Level 2 is optional on a busy day.** It is 15 more minutes per candidate on a
queue that §7.5 already flags as time-constrained — the pair is 30 minutes since
level 1 was cut from 20 to 15 on 21 Aug. If the hall backs up, run more
devices; if that is not enough, level 1 alone still produces the queue order.

**Assessment is a queue-prioritisation tool, not a gate.** See §6.3.

---

## 5. THE ASSESSMENT — QUESTION BANK

> **Read this before using any version.**
>
> | | `HAG-WALKIN-L1-v1` | `HAG-WALKIN-L1-v5` |
> |---|---|---|
> | Format | 13 questions · 15 min | **15 questions · 15 min** |
> | Tests | Arithmetic, reasoning, site vocabulary | **General workplace behaviour and judgement** |
> | Sections | A 5 · B 3 · C 5 | A 4 · B 4 · C 4 · D 3 |
> | Delivery | Printed paper, hand-marked | **Online, auto-marked** |
> | Where | §5.0 below | §5.4 below |
> | Use it for | Wi-Fi failure fallback | **The 22 Aug drive** |
>
> **v5 is the paper the drive runs on.** v1 is retained verbatim as the offline
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

### 5.4 v5 — the live online paper (`HAG-WALKIN-L1-v5`)

**Format:** 15 MCQs · 1 mark each · 15 marks · 15 minutes · no negative marking

| Section | Name | Q | Marks |
|---|---|---|---|
| A | Work Attitude & Ownership | 1–4 | 4 |
| B | Communication & Teamwork | 5–8 | 4 |
| C | Reliability & Time Management | 9–12 | 4 |
| D | Problem Solving & Judgement | 13–15 | 3 |

**It looks like a DISC personality questionnaire but it is not one.** Plain
language, general workplace behaviour, no trade content — but unlike DISC it has
correct answers and produces a score.

That difference matters. A real DISC profile measures *preference*: "do you
prefer to lead, to work with people, or to work alone?" has no wrong answer, so
it produces a style (High D, secondary C) and **cannot rank candidates**. It is
also, by its own publishers' guidance, **not validated for selection decisions**
— it belongs in the interview conversation, not in a screening gate.

This paper instead asks what a person would *do* in an ordinary work situation,
where one option is defensibly better than the others. So it still scores
instantly, and the drive can still use it to decide who the panel sees first
(§6.3).

**Every question is general on purpose.** v3 and v4 were built around
interior/façade/PEB situations. That was wrong for this drive: the same paper is
sat by a Sales Executive, an Interior Designer, a Documentation Controller and a
Factory Operations candidate, and a question about plastering sequence tests
exposure to site work rather than judgement. v5 covers attitude and ownership,
communication and teamwork, reliability and time management, and problem
solving — things every one of the 13 positions is expected to have.

**Medium difficulty.** The wrong options are not stupid: each set contains the
two traps people actually fall into — the passive one (say nothing, wait) and
the over-corrective one (refuse, cancel everything, argue).

**⚠️ Not AI-proof, and cannot be made so.** A language model answers these very
well. **Invigilation — phones collected at the desk — is the control.**

**Canonical source of the questions and the key:**
`supabase/functions/_shared/assessment-bank.ts`. **Server-only** — imported by
the `assessment` edge function, never bundled into a browser.

**Printed answer key:** `npm run assessment:pdf` regenerates
`Hagerstone_Walkin_Assessment_v5_15Q_ANSWER_KEY.pdf` from that module. Every
question, correct option, section count and band row is derived, so the sheet
cannot drift from the live test. **Evaluator only.** Its A/B/C/D letters are the
canonical order — the online test shuffles options per candidate, so check a
printed sheet by option text, not by letter.

**Where candidates sit it:** `https://hr-hiring-automation.vercel.app/test.html`
No login. The candidate types an email address and their full name; the email is
the key that separates one person's answers and score from another's. See §7.

**Superseded — do not reuse these ids.** v2 (20 Q) tested arithmetic and site
vocabulary. v3 (25 Q, 35 min) was situational but too hard and too slow. v4
(20 Q) was easier but still site-specific. Their attempts stay readable.

### 5.5 v1 printed paper

A print-ready PDF exists: `Hagerstone_Walkin_Assessment_13Q.pdf`
- Page 1 — question paper (single sheet, issue to candidate)
- Pages 2–3 — answer key and evaluation notes (**evaluator only, never issue**)

Header fields on the paper: Candidate Name · Position Applied For · Mobile Number.
Footer: candidate declaration + signature, date, invigilator signature.

---

## 6. SCORING

### 6.1 Bands

**v5 — 15 marks (the live online paper):**

| Score | % | Band | Action |
|-------|---|------|--------|
| 13–15 | 85%+ | STRONG | Shortlist — send to technical panel first |
| 9–12 | 60%+ | AVERAGE | Proceed to interview normally |
| 6–8 | 40%+ | WEAK | Judge by role and experience |
| 0–5 | <40% | BELOW_BAR | Interview only if experience is strong |

**v1 — 13 marks (the printed fallback):**

| Score | Band | Action |
|-------|------|--------|
| 11–13 | Strong | Shortlist — send to technical panel first |
| 8–10 | Average | Proceed to interview normally |
| 5–7 | Weak | Judge by role and experience |
| 0–4 | Below bar | Interview only if experience is strong |

The v5 cuts are the v1 cuts rescaled to the same percentages, so a STRONG on
any version means roughly the same thing. `assessment_id` on the attempt records
which paper was sat.

### 6.2 Section-level reading

Worth recording section scores separately, not just the total. v5 stores all
four; the Assessment panel shows them per candidate. What each pattern means:

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
| Timer | 15 minutes, visible, counted against the **server's** `ends_at` (client clocks on borrowed phones are not trustworthy). Auto-submits on expiry. |
| Navigation | Back/forward, plus a 15-cell palette showing what is answered. No penalty for changing an answer. |
| Partial submit | Whatever is answered is scored; unanswered = 0. No negative marking. Past the timer the paper is still marked and flagged `auto_submitted` — a candidate never loses their work to a slow phone. |
| Resume | An attempt in progress resumes on the **same** token, paper and remaining time. A refresh, a dead battery or a dropped connection does not cost a fresh attempt or a fresh 15 minutes. Answers mirror to `localStorage` on every tap. |
| Retake | **One attempt per candidate per drive.** Re-opening with a used email shows the earlier score and directs them to the HR desk. HR clicks **Allow retake** in the Assessment panel to grant exactly one re-sit; the unlock is consumed by the next start, so it cannot become unlimited re-sits. |
| Device | Built for a low-end Android: one question per screen, 44px+ tap targets, 16px inputs, no hover-only cues. |
| Offline fallback | The printed v1 paper (§5.0, §5.5) stays in use. If the venue Wi-Fi fails, HR switches to paper without losing the day. |
| What the candidate sees | Total score out of 15 and the four section scores. **Not** the band, and **not** the correct answers — the band is an internal routing signal (§6.3), and printing the key on screen would leak the paper across the hall within an hour. |

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

> **Built, 21 August 2026 — see §7.7.** It is keyed to **position** rather than
> department, because the four departments each span roles that share almost no
> technical ground: Procurement, Sales Manager, Sales Executive and Documentation
> Controller are one department and four different jobs. This paragraph stands as
> written for the level-1 paper — level 1 must stay general.

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

### 7.7 The second-level, position-specific assessment

Built 21 August 2026, as §7.5 reserved. **A second paper, sat after level 1**,
whose questions are chosen by the position the candidate applied for.

| | Level 1 | Level 2 |
|---|---|---|
| URL | `/test.html` | `/test2.html` |
| Start screen asks | email · name | email · name · **position applied for** |
| Papers | one, sat by all 13 positions | **13**, one per position (§2.2) |
| Content | general workplace behaviour | role-specific, medium difficulty |
| Length | 15 Q · 15 marks · 15 min | 12 Q · 12 marks · 15 min |
| Sections | 4, fixed | 4, **different per paper** |
| Bands | 13 / 9 / 6 | 9 / 6 / 4 |
| Paper id | `HAG-WALKIN-L1-v5` | `HAG-ROLE-<POSITION>-v1` |
| Bank | `_shared/assessment-bank.ts` | `_shared/role-assessment-bank.ts` |

**Why position and not department.** §7.5 proposed keying it to `department`.
Four departments cover thirteen jobs with almost no shared technical ground — a
Documentation Controller and a Sales Executive are the same department. Keyed to
position, every candidate gets questions about the work they applied to do.

**Why a separate URL rather than a choice on one screen.** The desk hands out one
link or the other. A candidate on a borrowed phone in a queue should never have
to decide which test they are supposed to be sitting.

**Everything else is deliberately identical** and shares the same machinery: same
table, same edge function, same candidate component (a `kind` prop), same HR
panel, same anonymous-browser security shape (§7.1), same server-issued token,
same server-side timer and marking, same one-attempt-and-HR-unlock rule — which
applies **per paper**, so sitting level 1 does not block level 2.

**Bands are cut lower** (9–12 STRONG · 6–8 AVERAGE · 4–5 WEAK · 0–3 BELOW_BAR)
because these test exposure, not judgement: a capable candidate can legitimately
miss three of twelve. Re-cut them against real data after the drive.

**§6.3 applies with extra force.** A low level-2 score may mean nothing more than
that the candidate applied for the position next to the one they have actually
spent ten years doing. It is a queue order. It must never auto-reject, and the
panel has no minimum-score filter for either paper.

**The answer key is engineering judgement, not signed-off Hagerstone policy** —
and more so than level 1, because these encode how a specific role is expected
to be performed. See §9.3; none of it has HR or department-head sign-off as of
21 Aug 2026.

**HR sees both** in Sidebar → Onboarding → Assessment, behind a **Test** selector
(Level 1 / Level 2) plus a **Position** filter on level 2. Per-question review,
CSV export and the retake unlock all work the same for both.

Engineering detail — invariants, versioning, the `submit`-refuses-to-mis-mark
rule, and `npm run assessment:verify-roles` — is in `CLAUDE.md`.

### 7.8 Deploying level 2

```
1. Apply supabase/migrations/20260821090000_hr_assessment_role_level2.sql
2. supabase functions deploy assessment   (the shared function; level 1 unaffected)
3. Deploy the app. The candidate page is /test2.html
```

Additive throughout: every column is nullable or defaulted, an absent `kind` on
a `start` call still means level 1, and an older cached candidate page keeps
working unchanged.

---

## 8. SUPPORTING ASSETS

| Asset | File / Location | Notes |
|-------|-----------------|-------|
| Carousel posters (14) | `Drive_22Aug_Card01..14_*.png` | 2160×2160, 1:1 |
| Online assessment (level 1) | `/test.html` on the hiring app | v5 · 15 Q · live · see §7 |
| Online assessment (level 2) | `/test2.html` on the hiring app | 13 papers · 12 Q each · see §7.7 |
| Question bank + key (level 1) | `supabase/functions/_shared/assessment-bank.ts` | **Server-only. Never publish.** |
| Question bank + key (level 2) | `supabase/functions/_shared/role-assessment-bank.ts` | **Server-only. Never publish.** |
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

Three pieces of content were drafted from general industry knowledge, **not** from
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

3. **The 156 level-2 answers** (§7.7) — 13 papers × 12 questions in
   `_shared/role-assessment-bank.ts`. This is now the **largest** unsigned-off
   block of content in the project and the most exposed, because every answer is
   a claim about how a named Hagerstone role is expected to work. The ones most
   likely to be contested, by paper:

   - **Project Manager** Q4 (written variation before extra work starts) and
     Q12 (partial handover against a snag list) — both describe your commercial
     process, not a general truth.
   - **Site Engineer** Q12 and **Site Supervisor** Q12 — whose instruction the
     team may act on, and what happens when the reporting line is absent.
   - **MEP Engineer** Q9 — holding a concrete pour for missing sleeves. Correct
     engineering, but it is a real cost and someone senior has to own the call.
   - **Procurement** Q9 (declining and reporting a vendor gift) and Q8 (advance
     payment) — these are conduct and treasury policy, not judgement.
   - **Documentation Controller** Q10 — refusing to backdate a transmittal, and
     escalating if pressed.
   - **Sales Manager** Q7 / **Sales Executive** Q11 — discounting authority and
     what happens when an executive quotes below it.

   Ninety minutes with a project head, a procurement head and a sales head covers
   all of them. Until then they are defensible engineering judgement and nothing
   more, and a candidate who argues one at interview may simply be right.

None of the three has been reviewed by HR or department heads. Two further
specific items to verify:
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
