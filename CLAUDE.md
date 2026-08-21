# CLAUDE.md — working notes for this repo

Orientation for anyone (human or agent) picking this up. `HANDOFF.md` is the
long-form history for the attendance / location / SSO side; this file is the
short version plus the walk-in assessment system, which was built on
**19 August 2026** and is the newest thing here.

---

## Stack

- **React 18 + Vite 5**, plain JSX. No TypeScript, no router, no test runner, no
  component library, no Tailwind. Styling is one global stylesheet plus inline
  `style={{}}`, and scoped CSS files for the standalone portals.
- **Supabase** (hub project `tpfvnerrjhqwipyonngf`). All app tables live in the
  **`hr` schema** — `src/supabaseClient.js` sets `{ db: { schema: "hr" } }`, so
  `supabase.from("applicants")` means `hr.applicants`.
- **Vercel**, auto-deploys from `main`. Takes ~1 minute.

### Multi-page build — three entry points

`vite.config.js` → `build.rollupOptions.input`. **Adding a page means adding it
there**, or it builds locally and 404s in production.

| URL | Entry | Who it's for |
|---|---|---|
| `/` | `index.html` → `src/App.jsx` | HireFlow admin app (Hub login required) |
| `/attend.html` | `src/attend-main.jsx` | Employee attendance portal (Hub login required) |
| `/test.html` | `src/test-main.jsx` | **Walk-in candidate assessment — no login at all** |

### Navigation

There is no router. `panel` is a string in `src/context/AppContext.jsx`, switched
by `{panel === "x" && <X/>}` in `src/App.jsx`. A new panel needs three edits:
the import + line in `App.jsx`, the `HIRING` set in `App.jsx` (module gating),
and the group in `src/components/layout/Sidebar.jsx`.

### Layering

Panels never call `supabase` directly. Data access lives in `src/services/*.js`.
Follow that — `AttendanceAdmin.jsx` is the reference panel (filters → `useCallback`
loader → service → stat tiles → CSV export via Blob).

---

## Hard rules

1. **`public.employees` and every non-`hr` schema are read-only from here.** They
   are shared with other live Hagerstone apps. See `HANDOFF.md` §9.
2. **RLS policy helpers must be wrapped in `(select …)`.** Migration
   `20260819062423_hr_rls_helper_calls_as_initplan.sql` exists because bare calls
   re-evaluate per row and hit the 8s statement timeout. `using ((select hr.has_hireflow()))`,
   never `using (hr.has_hireflow())`.
3. **`anon` gets nothing.** `supabase/rls-hardening-golive.sql` records that anon
   could once read `hr.applicants` and even INSERT into it. Do not add an anon
   policy. Public features go through an edge function on the service-role key.
4. **Edge functions bypass RLS by design** and must do their own authorisation.
   `attendance-punch` is the reference for a logged-in caller; `assessment` is the
   reference for an anonymous one.
5. **Views over RLS tables need `security_invoker = true`** or they leak the table.
6. Migrations are idempotent, use `text` + named `check` constraints rather than
   Postgres enums, and carry a long `-- ===` header explaining *why*. Match that.
7. Secrets live in `.env` (gitignored) and as Supabase function secrets. Never commit them.

---

## Commands

```bash
npm install
npm run dev     # localhost:5173/ , /attend.html , /test.html
npm run build   # must pass before pushing
```

Applying a migration: the Supabase dashboard SQL editor, or the Supabase MCP
`apply_migration`. The local CLI is **not** authenticated (`npx supabase` will ask
for `SUPABASE_ACCESS_TOKEN`), so edge functions are currently deployed through the
MCP `deploy_edge_function` tool. The files in `supabase/functions/` are the source
of truth — if you deploy by pasting, paste what is in the repo.

---

## The walk-in assessment (built 19 Aug 2026)

Digitises the paper screening test for the **22 August 2026** mass interview
drive. Full product spec: `HAGERSTONE_DRIVE_AND_ASSESSMENT.md` §5–§7. That
document is the source of truth for the drive; this section is the engineering
summary.

### The pieces

| Piece | Path |
|---|---|
| Candidate page | `test.html` → `src/components/assessment/AssessmentPortal.jsx` + `.css` |
| Candidate API client | `src/services/assessmentApi.js` |
| Server | `supabase/functions/assessment/index.ts` (actions `start`, `submit`) |
| **Question bank + answer key** | `supabase/functions/_shared/assessment-bank.ts` |
| Table | `hr.assessment_attempts` |
| HR panel | `src/components/panels/AssessmentResults.jsx` + `src/services/assessmentService.js` |
| Migrations | `20260819120000_hr_walkin_assessment_attempts.sql`, `20260819160000_hr_assessment_v3_five_sections.sql` |

### The shape, and why

A candidate is a walk-in with no Hub account and no time to be given one. The
start screen takes an **email and a full name**; the lowercased email is the key
that separates one person's answers and score from another's. That makes the
browser anonymous, which forces everything else:

- `hr.assessment_attempts` has RLS on, **no anon policy and no anon grant**.
- Every candidate read/write goes through the `assessment` edge function on the
  service-role key.
- The browser is trusted for nothing that matters: `attempt_token` is issued
  server-side, `ends_at` is computed from the server's `started_at`, and marking
  happens on the server.

### Invariants — break these and it fails quietly

- **Never import `assessment-bank.ts` into anything under `src/`.** It holds the
  answer key. The candidate bundle would ship it to every phone in the hall.
  `publicQuestions()` strips `answer` and `explanation`; that is the only way
  question text reaches a browser. Verify after a build:
  `grep -r "worker-days\|is_correct\|\"answer\"" dist/assets/test-*.js` → nothing.
- **`presented`** stores the option order each candidate saw (options shuffle per
  candidate; question order is fixed). Without it a stored attempt cannot be
  re-marked.
- **`review`** is the marked paper snapshotted at submit — question text, what
  they chose, what was correct, the explanation. It exists so the HR panel can
  show a reviewed attempt **without the key ever being in a browser bundle**.
  The panel reads this row; it does not re-mark anything.
- **Never edit a version in place once candidates have sat it.** Change
  `ASSESSMENT_ID` and mint the next version. Scores across versions are not
  comparable; `assessment_id` on the attempt records which paper was sat, and the
  panel scores each row out of the paper it actually sat (`marksFor()` in
  `assessmentService.js`).
- **Changing the mark count means changing the check constraint.** The v2→v3 move
  from 20 to 25 marks needed `assessment_attempts_score_check` widened, or every
  submit scoring 21+ would have failed silently — exactly the strongest candidates.
- **A new section means a new nullable column** (`score_section_e` was added this
  way). Nullable so older-version attempts stay readable.
- **The retake unlock is consumed on the next start.** `retake_unlocked` grants
  exactly one re-sit, not unlimited ones. HR sets it from the panel.
- **`localStorage` keys are version-suffixed** (`hag_assessment_session_v4`) so a
  half-finished older sheet cached on a phone cannot restore on top of a new paper.
- If you change `TOTAL_QUESTIONS` or `DURATION_MINUTES`, also update
  `BRIEF_QUESTIONS` / `BRIEF_MINUTES` in `AssessmentPortal.jsx` — the start screen
  briefs the candidate before the server has said anything.

### Current paper — `HAG-WALKIN-L1-v4`

20 questions · 20 marks · 25 minutes · no negative marking. Every question is a
short situation: what would you **do**, what procedure would you follow, how
would you handle the client. Plain register, clearly-wrong distractors.

| Section | Name | Q | Marks |
|---|---|---|---|
| A | Site Execution & Sequencing | 1–4 | 4 |
| B | Client & Stakeholder Handling | 5–9 | 5 |
| C | Procedure & Documentation | 10–14 | 5 |
| D | Commercial Judgement | 15–17 | 3 |
| E | Safety & Problem Diagnosis | 18–20 | 3 |

Bands: **17–20 STRONG · 12–16 AVERAGE · 8–11 WEAK · 0–7 BELOW_BAR.**

**v4 is deliberately easier than v3, and that costs discrimination.** An easy
paper clusters scores near the top, and a score everyone gets 17+ on cannot
decide who the panel sees first — which is the only thing it is for. If the
spread on the day is too tight, **re-cut `bandFor()` against real attempt data.**
Bands can change freely; questions cannot once they have been sat.

Version history — do not reuse any of these ids:

| id | | |
|---|---|---|
| v1 | 13 Q printed | still the Wi-Fi-failure fallback |
| v2 | 20 Q online | superseded — tested arithmetic and site vocabulary |
| v3 | 25 Q online | superseded — situational but judged too hard for a walk-in queue |
| v4 | 20 Q online | **live** |

### The answer-key PDF

`npm run assessment:pdf` → `Hagerstone_Walkin_Assessment_v4_20Q_ANSWER_KEY.pdf`.

Generated by `scripts/make-assessment-pdf.mjs` **entirely from the bank** —
questions, options, correct answers, section counts and the band table are all
derived, nothing is hardcoded. Regenerate after any change to the paper; never
hand-edit the PDF. (A hardcoded band table in an early version silently kept
v3's numbers after the paper became v4, which is why everything is derived now.)

Needs `playwright-core` (a devDependency, not in the app bundle) plus a one-time
`npx playwright-core install chromium`.

### Two things that are not code problems

- **The paper is not AI-proof and cannot be made so.** An LLM answers
  situational-judgement questions very well. Question design only makes the paper
  hard to answer *without real experience*. **Invigilation — phones collected at
  the desk — is the control.** Do not let anyone believe otherwise.
- **The answers are engineering judgement, not Hagerstone policy.** Almost every
  v3 answer is a claim about how Hagerstone expects people to behave (Q6 verbal
  variations, Q10 non-payment escalation, Q12 whose instruction is valid, Q2
  structural escalation, Q13 GRN practice). As of 19 Aug 2026 **none of these have
  HR or department-head sign-off** — `HAGERSTONE_DRIVE_AND_ASSESSMENT.md` §9.3
  tracks it. A candidate can challenge any of them at interview.

### The score is a sort, not a gate

`HAGERSTONE_DRIVE_AND_ASSESSMENT.md` §6.3 is explicit: this decides **who the
panel sees first** on a busy day. It must never auto-reject. The panel sorts by
score descending and deliberately has no minimum-score filter. Do not add one —
an experienced site supervisor may score low and still be the right hire.

### What the candidate sees vs what HR sees

Candidate: total score and the five section scores. **Not** the band (an internal
routing signal — someone reading "BELOW_BAR" in the waiting area may leave a
queue they were never going to be rejected from) and **not** the correct answers
(it would leak the paper across the hall within the hour).

HR (Sidebar → Onboarding → Assessment): everything, plus per-question review,
CSV export, and the retake unlock. Gated on the **`hireflow` module**, not on the
admin role — `ea@hagerstone.com` (HAG-018) has an explicit grant;
`ritudesaiwal@gmail.com` (HAG-037, role `ea`) is attendance-only and will not see
the panel.

### Verifying a change

There is no test runner. What was used, and is worth repeating:

1. `npm run build` — must pass.
2. Drive the edge function directly: `start`, match correct answers by **option
   text** against the shuffled options served, then `submit`. A perfect paper must
   score full marks and an all-wrong paper zero — this is what proves the
   display→canonical mapping survives the shuffle. Getting this wrong mis-marks
   the entire day silently.
3. Confirm no key leaks: no `answer` / `explanation` / `is_correct` in the `start`
   response or in `dist/assets/test-*.js`.
4. Confirm anon is still locked out:
   `curl "$URL/rest/v1/assessment_attempts?select=*" -H "apikey: $ANON" -H "Accept-Profile: hr"`
   must return `permission denied`.
5. Mobile. **Every candidate takes this on a phone.** Check 320 / 360 / 412 wide
   and landscape: no sideways scroll, every option reachable past the fixed bottom
   bar, Submit reachable in the review sheet.
6. Delete test rows afterwards — `delete from hr.assessment_attempts where email like '%@example.com'`.

---

## Where to read more

| For | Read |
|---|---|
| The drive, the paper, scoring policy | `HAGERSTONE_DRIVE_AND_ASSESSMENT.md` |
| Attendance / location / SSO history | `HANDOFF.md` |
| The access model | `supabase/rls-hardening-golive.sql` |
| Applied DDL and order | `supabase/migrations/README.md` |
| The original hiring product | `hagerstone-hiring-automation-blueprint.md` |

⚠️ `DEPLOY-NOTES.md` and `RUN-IN-SQL-EDITOR.sql` target the **old** project
`sgerslbmnwrltqrhsdir`. Historical — do not follow them against the hub.
