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
| `/test.html` | `src/test-main.jsx` | **Walk-in assessment, level 1 — no login at all** |
| `/test2.html` | `src/test2-main.jsx` | **Walk-in assessment, level 2 (role-specific) — no login** |

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

## The Office Team report (built 25 Aug 2026)

Sidebar → Employee Management → **Office Team**. A month sheet per person in the
layout Hagerstone already prints, downloadable as a real `.xlsx`. Built for the
EA (`ea@hagerstone.com`, HAG-018).

| Piece | Path |
|---|---|
| Panel | `src/components/panels/OfficeTeamAttendance.jsx` |
| Data access | `src/services/officeTeamService.js` |
| **Row shaping** | `src/services/officeTeamReport.js` |
| Excel writer | `src/services/officeTeamExcel.js` |
| Backfill importer | `scripts/import-hsipl-gap.mjs` |
| Acceptance test | `scripts/verify-office-team-report.mjs` |
| Migrations | `20260825120000`, `20260825130000` |

```bash
npm run attendance:verify-office-team    # must pass after any change here
```

### Things that will bite

- **`officeTeamReport.js` is the single source of row shape.** The panel and the
  Excel writer both read from it, and `buildWorkbook` takes reports the panel
  has *already built* rather than rebuilding them. Do not add a second
  derivation: the two looked identical when they were written separately too,
  right up until one changed and the EA was reading different numbers on screen
  from the ones she was emailing out.
- **Membership is a stored flag** (`hr.employee_profile.office_team`), not
  "whoever punched recently". Derived membership drops anyone away for a
  fortnight, and two of the fifteen had never punched on the portal when the
  report was built. The EA edits it from **Manage team**.
- **Managing the team needs `hr.is_hr_admin()`** — roles `admin, hr, founder,
  management, ai, mis`. HAG-018 is `admin` so it works. **HAG-037 (`ritudesaiwal@`,
  role `ea`) is not**, and because `attendance_subject` is `security_invoker` and
  reads `employee_profile`, she would see an *empty* team rather than an error.
  Widening `is_hr_admin` affects every `hr` table — grant the role instead.
- **Late is decided at MINUTE granularity** against `late_after`, in the view
  *and* in `officeTeamReport.isLate`. Deepak Bansal punched 09:30:58 on
  2026-07-11: second-exact comparison called it Late, the printed sheet says
  On Time. Never hardcode the threshold — it comes from settings.
- **`late_after` is 09:40** (`20260825140000`). It was briefly 09:30 to match
  the printed sheet, but that made six of the fifteen structurally late; the EA
  set 09:40, and anyone past it is Late with no further leniency. Because
  `attendance_day` is a view, changing it re-scores every month for everyone —
  and the sample PDF's July figures (19 On Time / 5 Late at 09:30) become
  22 / 2. That is the rule changing, not a regression.
- **A day with a check-in and no check-out gets BLANK hours, never 0.00.** Zero
  reads as "worked nothing" and quietly drags the month total down.
- **The footer sums the displayed column, not raw minutes.** Summing rounded
  values ≠ rounding a sum, and a total that does not match the column above it
  is the first thing anyone challenges.
- **ExcelJS is dynamically imported** (`exceljs/dist/exceljs.bare.min.js`) so it
  stays a lazy 855 KB chunk. Importing it normally puts it in the main bundle
  and every panel pays for a button most sessions never press. The `bare` build
  drops core-js polyfills this app never needed.

### The coverage gap is closed

`20260814074535` blanked out **2026-07-31 … 2026-08-11** — the days between the
end of the HSIPL import and the portal going live — because the spine scored
them all `absent`. Those days now hold 550 punches and 33 leave rows imported
from the sheet, so the window is cleared. **The mechanism is kept**: if the
portal goes dark again, setting `coverage_gap_from/to` is the whole fix.

Re-running the importer is safe — every row is checked against what is already
in the window. It **refuses to run** if a sheet name is not in its `NAME_MAP`,
because a guessed name files one person's fortnight under a colleague's.

### ⚠ The 2026 holiday calendar is wrong — do not trust it

`hr.holidays` was seeded by `20260730090000` from the sheet's Setting tab,
whose dates were **2024's**, with only the year swapped to 2026 (the migration
header says so, and says to verify them). That works for fixed-date holidays and
fails for every lunar one:

| | seeded | actually 2026 |
|---|---|---|
| New Year, Independence Day, Gandhi Jayanti | 01 Jan, 15 Aug, 02 Oct | ✅ correct |
| Raksha Bandhan | 19 Aug 2026 | ❌ that was 2024's date |
| Holi, Ashtami, Ramnavmi, Dusshara, Diwali, Bhaidooj | 2024's dates | ❌ likewise |

This is not cosmetic. `attendance_day` gives a holiday precedence over a punch,
so on a wrongly-dated holiday everyone who worked gets `day_status = 'holiday'`
and `day_credit` 0, and the day vanishes from `days_worked` / `on_time` /
`late`. On 19 Aug 2026, **10 of the 15 office team worked and lost the day.**

**Do not guess replacement dates.** Get the official Hagerstone 2026 list and
load it through Attendance Setup, which is where holidays belong. Until then the
office-team report under-counts anyone who worked a wrongly-dated holiday.

Separately worth deciding: even with correct dates, working *on* a holiday
currently scores zero credit. If people are expected to work holidays, that
needs its own rule.

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

> **Get a `SUPABASE_ACCESS_TOKEN` into `.env`.** Two things about the MCP deploy
> route bite hard, and both disappear with `npx supabase functions deploy assessment`:
>
> 1. **It takes file contents inline, so a function is only ever as correct as
>    what was retyped into the tool call.** For `assessment` that now means
>    ~130 KB across three files, including 171 answer keys. A single transposed
>    option mis-marks papers silently. Deploying from disk is byte-exact.
> 2. **It cannot place a file outside the function directory**, so
>    `import … from "../_shared/assessment-bank.ts"` fails to bundle. Pasted
>    deploys have to rewrite those to `"./assessment-bank.ts"` and upload the
>    banks as siblings — a deployed copy that differs from the repo.
>
> Also: `deploy_edge_function` **replaces the whole function**, with no dry run
> and no confirmation. There is no partial deploy — get the payload right first.
> A half-finished experiment deployed here **takes level 1 down**, on a drive day.

### Deploying `assessment` without a `SUPABASE_ACCESS_TOKEN`

Until the token exists, the function is pasted into the MCP tool, and pasting
~105 KB containing 171 answer keys is exactly the silent-mis-marking risk the
whole design guards against. So it is never pasted by hand from the banks —
it is **generated, proven, pasted, and then proven again against production**:

```bash
npm run assessment:payload -- <scratch>/payload.ts   # generate one flat file
npm run assessment:verify-payload -- <scratch>/payload.ts   # must pass BEFORE deploying
#   → paste <scratch>/payload.ts as the single file `index.ts` via the MCP tool
npm run assessment:verify-live                        # must pass AFTER deploying
```

- **`make-deploy-payload.mjs`** flattens both banks and the marking logic into
  one file, because the MCP tool cannot place a file outside the function
  directory (so `../_shared/…` never bundles). Data is emitted **one question
  per line** — an 83 KB single line cannot be transcribed or reviewed safely.
- **`verify-deploy-payload.mjs`** runs the payload's rewritten marking logic and
  the repo banks over the same shuffles and asserts they agree question by
  question. Rewritten marking logic is the thing that fails silently.
- **`verify-live-assessment.mjs`** drives the real API for level 1 and all 13
  role papers: every served question, scenario and option byte-compared to the
  bank, no key leaked, perfect paper full marks, all-wrong paper zero, unknown
  position refused. It writes `@example.com` rows and deletes them.

The repo remains the source of truth; the pasted file is a build artifact.

---

## The walk-in assessment (built 19 Aug 2026)

Digitises the paper screening test for the **22 August 2026** mass interview
drive. Full product spec: `HAGERSTONE_DRIVE_AND_ASSESSMENT.md` §5–§7. That
document is the source of truth for the drive; this section is the engineering
summary.

### The pieces

There are **two papers**. Level 1 is general and everybody sits it; level 2 is
role-specific and keyed to the position applied for. They share every piece of
machinery below except the bank.

| Piece | Path |
|---|---|
| Candidate page | `test.html` / `test2.html` → `src/components/assessment/AssessmentPortal.jsx` + `.css` (one component, `kind` prop) |
| Candidate API client | `src/services/assessmentApi.js` |
| Server | `supabase/functions/assessment/index.ts` (actions `start`, `submit`, `positions`) |
| **Level-1 bank + answer key** | `supabase/functions/_shared/assessment-bank.ts` |
| **Level-2 bank + answer key** | `supabase/functions/_shared/role-assessment-bank.ts` |
| Table | `hr.assessment_attempts` (both papers; `paper_kind` tells them apart) |
| HR panel | `src/components/panels/AssessmentResults.jsx` + `src/services/assessmentService.js` |
| Migrations | `20260819120000_hr_walkin_assessment_attempts.sql`, `20260819160000_hr_assessment_v3_five_sections.sql`, `20260821090000_hr_assessment_role_level2.sql` |

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

- **Never import either bank into anything under `src/`.** They hold the answer
  keys. The candidate bundle would ship them to every phone in the hall.
  `publicQuestions()` / `publicRoleQuestions()` strip `answer` and
  `explanation`; that is the only way question text reaches a browser. Verify
  after a build:
  `grep -rlE '"answer"|explanation|is_correct' dist/assets/test-*.js dist/assets/test2-*.js dist/assets/AssessmentPortal-*.js` → nothing.
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
- **`localStorage` keys are version-suffixed** (`hag_assessment_session_v5`) so a
  half-finished older sheet cached on a phone cannot restore on top of a new paper.
- If you change `TOTAL_QUESTIONS` or `DURATION_MINUTES`, also update
  the matching entry in `BRIEF` in `AssessmentPortal.jsx` — the start screen
  briefs the candidate before the server has said anything.

### Current paper — `HAG-WALKIN-L1-v5`

15 questions · 15 marks · 15 minutes · no negative marking.

| Section | Name | Q | Marks |
|---|---|---|---|
| A | Work Attitude & Ownership | 1–4 | 4 |
| B | Communication & Teamwork | 5–8 | 4 |
| C | Reliability & Time Management | 9–12 | 4 |
| D | Problem Solving & Judgement | 13–15 | 3 |

Bands: **13–15 STRONG · 9–12 AVERAGE · 6–8 WEAK · 0–5 BELOW_BAR.**
Section E is unused; the column stays so v3/v4 attempts remain readable.

**It reads like a DISC questionnaire but it is not one.** Plain language,
general workplace behaviour, no trade content — but unlike DISC it has correct
answers and produces a score. That distinction is load-bearing: a real DISC
profile measures *preference*, has no wrong answers, yields a style rather than
a number, and therefore **cannot rank candidates**. This paper asks what a
person would *do*, where one option is defensibly better, so it still scores and
the drive can still use it to decide who the panel sees first (§6.3).

If a genuine DISC profile is ever wanted, build it as a **separate instrument
with its own kind** — do not strip the answers out of this one. `score_total`,
`band` and the entire admin panel assume right/wrong.

**Every question is general on purpose.** v4 was built around interior/façade/PEB
situations, which was wrong: the same paper is sat by a Sales Executive, an
Interior Designer, a Documentation Controller and a Factory Operations
candidate, and a question about plastering sequence tests exposure to site work
rather than judgement. The PDF verifier asserts no trade words appear.

Version history — do not reuse any of these ids:

| id | | |
|---|---|---|
| v1 | 13 Q printed | still the Wi-Fi-failure fallback |
| v2 | 20 Q online | superseded — arithmetic and site vocabulary |
| v3 | 25 Q online | superseded — situational but too hard, and site-specific |
| v4 | 20 Q online | superseded — easier, still site-specific |
| v5 | 15 Q online | **live** — general workplace behaviour |

---

## The level-2 role assessment (built 21 Aug 2026)

The second paper. Same drive, same hall, same phones — sat **after** level 1,
keyed to the position the candidate applied for. `HAGERSTONE_DRIVE_AND_ASSESSMENT.md`
§7.5 reserved it in exactly this shape: *"Do not add role-specific technical
questions to this paper — all 13 positions sit it. If department-level technical
screening is wanted, build it as a separate second-level assessment."*

**15 papers · 12 questions · 12 marks · 15 minutes · 4 sections of 3.**
`supabase/functions/_shared/role-assessment-bank.ts`, one paper per position in
§2.2, ids `HAG-ROLE-<POSITION>-v1`.

| id | position | id | position |
|---|---|---|---|
| `…-PROJECT-MANAGER-v1` | Project Manager | `…-ARCHITECT-v1` | Architect |
| `…-SITE-ENGINEER-v1` | Site Engineer | `…-FACADE-FACTORY-MANAGER-v1` | Façade Factory Manager |
| `…-SITE-SUPERVISOR-v1` | Site Supervisor | `…-FACTORY-OPERATIONS-v1` | Factory Operations |
| `…-CIVIL-ENGINEER-v1` | Civil Engineer | `…-PROCUREMENT-v1` | Procurement |
| `…-MEP-ENGINEER-v1` | MEP Engineer | `…-SALES-MANAGER-v1` | Sales Manager |
| `…-INTERIOR-DESIGNER-v1` | Interior Designer | `…-SALES-EXECUTIVE-v1` | Sales Executive |
| `…-MARKETING-v1` | Marketing \*| `…-DOCUMENTATION-CONTROLLER-v1` | Documentation Controller |
| `…-ACCOUNTS-v1` | Accounts \*| | |

\* **Marketing and Accounts are NOT §2.2 drive positions.** They are not on the
Google Form, not on a poster and not in the Indeed listing, so nobody applied for
them through the funnel — they were added on request. The `/test2.html` dropdown
therefore offers two options the drive never advertised. If that is unwanted,
delete the two papers rather than hiding them in the page: the server decides
which positions exist, and a page-only change would drift from it.

Bands are cut **lower** than level 1 — **9–12 STRONG · 6–8 AVERAGE · 4–5 WEAK ·
0–3 BELOW_BAR** — because these test role exposure, where a capable candidate can
legitimately miss three of twelve. Re-cut them against real data; never re-cut a
question that has been sat.

### What is different from level 1, and why

- **The start screen asks for a third thing: the position.** It is a required
  dropdown and it is what selects the question paper. The list is served by the
  `positions` action rather than hardcoded in the page, so the options and the
  papers cannot drift; `FALLBACK_POSITIONS` in `AssessmentPortal.jsx` covers a
  failed fetch on venue Wi-Fi and the server validates the pick regardless.
- **Position matching is normalised** (`normalisePosition()`): NFD, case-folded,
  then everything that is not `a–z0–9` dropped. That is what makes "Façade",
  "Facade" and a decomposed-cedilla paste from the Google Form all land on the
  same paper. An unmatched position is a **400 with a clear message**, never a
  silent fallback to somebody else's paper.
- **Separate URL, not a mode picker.** `/test2.html`, its own entry in
  `vite.config.js`. The desk hands out one link or the other so a nervous
  candidate never has to decide which test they are meant to be sitting.
- **`localStorage` keys are suffixed by kind as well as version**
  (`hag_assessment_role_session_v1`). Two papers on one phone is the ordinary
  case here, not an edge case.
- **The papers are versioned individually.** Fixing a Site Engineer question
  bumps `HAG-ROLE-SITE-ENGINEER-v1` → `-v2` and leaves the other twelve alone.
- **`submit` never trusts the caller for which paper it is.** It reads
  `paper_kind` / `position_applied` off the attempt row. If the row's
  `assessment_id` no longer matches the current paper for that position, it
  **refuses with a 409 rather than mis-marking** — `presented` indexes into the
  question array the candidate actually sat, so marking against a bumped paper
  would silently score the wrong answers. HR unlocks a re-sit instead.

### The shared machinery

One table, one edge function, one candidate component, one HR panel.
`paper_kind` (`'L1'` | `'ROLE'`) is what tells the two apart, and because
`assessment_id` is part of `assessment_attempts_email_attempt_uniq`, a candidate
sitting both papers is already two non-colliding rows — the one-attempt block
and the retake unlock both work **per paper** with no extra code.

- **`section_meta` is written at start**, not at submit. Level 1 has one fixed
  set of sections; the 13 role papers each have their own, so the panel cannot
  hardcode them. Same argument as `review`: the row describes its own paper, and
  stays readable after that paper is superseded.
- **`marksFor(row)`** prefers `review.length`, then `section_meta`, then the
  version table. Do not add the 13 role ids to `PAPER_MARKS` — that is one more
  place to forget.
- **The score check constraint is now 0–50** (was 25). Re-read the v2→v3 note in
  `20260819160000`: outgrowing it fails the submit *silently*, for exactly the
  strongest candidates.
- **`position_applied`, not `position`.** Bare `position` is a Postgres
  function-name keyword and reads ambiguously unquoted.

### The answer key is engineering judgement, not Hagerstone policy

This caveat is **stronger here than on level 1**. Level 1's answers are claims
about general workplace behaviour; these are claims about how Hagerstone expects
a specific role to be performed — that a variation is raised before extra work
starts, that a pour is held for missing sleeves, that a gift from a vendor is
declined and reported. As of 21 Aug 2026 **none of it has HR or department-head
sign-off**. A candidate can defensibly argue any of it at interview; that is a
conversation, not a marking bug. Tracked with §9.3.

Also unchanged from level 1: **the paper is not AI-proof and cannot be made so**,
and **the score is a sort, not a gate** — with an extra edge here, since a low
role score may only mean the candidate applied for the position next to the one
they have actually spent ten years doing.

### Verifying a change to the role bank

`scratchpad/verify-role-bank.mjs` (see the git history of this change) does the
whole of the CLAUDE.md checklist offline:

```bash
npx esbuild supabase/functions/_shared/role-assessment-bank.ts --format=esm --outfile=<scratch>/rb.mjs
node <scratch>/verify-role-bank.mjs
```

It asserts 13 papers, 12 questions each, section counts matching the declared
sections, answer indices in range, no duplicate option text — and then, 40
shuffles per paper, that answering **by option text** against the served
(shuffled) options scores full marks and that answering deliberately wrong scores
zero. That last one is the check that proves the display→canonical mapping
survives the shuffle; getting it wrong mis-marks the entire day silently.

---

### The answer-key PDF

`npm run assessment:pdf` → `Hagerstone_Walkin_Assessment_v5_15Q_ANSWER_KEY.pdf`.

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
