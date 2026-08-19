-- ============================================================================
-- Walk-in assessment: hr.assessment_attempts
--
-- The 22 Aug mass interview drive currently runs on a printed 13-question paper
-- that an evaluator marks by hand (HAGERSTONE_DRIVE_AND_ASSESSMENT.md §5). That
-- does not scale to a full-day walk-in queue and leaves no structured record.
-- This table is the digital version described in §7.1 of that document, holding
-- one row per candidate attempt at HAG-WALKIN-L1-v2 (20 questions, 20 marks).
--
-- WHY THE CANDIDATE HAS NO LOGIN
-- Candidates are walk-ins. They have no Hub account and there is no time to make
-- them one at the door, so the test identifies them by the email address they
-- type on the start screen. That means the browser is anonymous — and anon must
-- NOT be able to touch this table. rls-hardening-golive.sql exists precisely
-- because anon could once read hr.applicants and even INSERT into it. So:
--
--   * this table gets RLS with a single `to authenticated` policy;
--   * anon gets NO policy and NO grant — it cannot read or write a single row;
--   * every candidate-side read/write goes through the `assessment` edge
--     function on the service-role key, same shape as attendance-punch.
--
-- The answer key never leaves the server either. It lives in
-- supabase/functions/_shared/assessment-bank.ts and is applied there; the
-- browser only ever sees question text and options.
--
-- WHY `presented` EXISTS
-- Option order is shuffled per question — candidates sit next to each other in
-- the hall. `presented` records the exact order this candidate saw, so §7.3
-- holds: any stored attempt stays re-markable against the paper it was sat on.
--
-- WHY THE POLICY WRAPS ITS HELPER IN (select …)
-- Not cosmetic. See 20260819062423_hr_rls_helper_calls_as_initplan.sql — an
-- unwrapped helper call re-evaluates once per row and times the query out.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists hr.assessment_attempts (
  id uuid primary key default gen_random_uuid(),

  -- Versioned per §7.3. Questions are NEVER edited in place; a changed paper
  -- mints a new assessment_id, and scores across ids are not comparable.
  assessment_id text not null default 'HAG-WALKIN-L1-v2',

  -- The candidate's identity. Stored lowercased + trimmed by the edge function
  -- so 'Ravi@Gmail.com ' and 'ravi@gmail.com' are the same person.
  email      text not null,
  full_name  text not null,
  attempt_no integer not null default 1,

  -- The browser's only credential. Issued by the server on start, required on
  -- submit. A candidate cannot submit against somebody else's attempt.
  attempt_token uuid not null default gen_random_uuid(),

  -- Attempts stand alone and are keyed by email, because a pure walk-in may
  -- never have filled the Google Form. HR links the CV record afterwards.
  applicant_id uuid references hr.applicants(id) on delete set null,

  started_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  duration_seconds integer,
  auto_submitted   boolean not null default false,

  answers   jsonb,   -- { "1": "C", "2": "A", … } canonical option letters
  presented jsonb,   -- per-question option order actually shown

  -- The marked paper, snapshotted at submit: question text, what the candidate
  -- chose, what was correct, and why. It exists so the HR panel can show a
  -- reviewed attempt WITHOUT the answer key ever being shipped into a browser
  -- bundle. It is also the §7.3 guarantee in its strongest form — the row
  -- carries the exact paper this candidate sat, independent of the code.
  review jsonb,

  score_total     integer,
  score_section_a integer,   -- Numerical Aptitude        (5)
  score_section_b integer,   -- Logical Reasoning         (5)
  score_section_c integer,   -- General Industry Awareness(6)
  score_section_d integer,   -- Situational Judgement     (4)
  band            text,
  status          text not null default 'in_progress',

  -- Retake is HR-unlock only. A candidate re-opening the link sees their old
  -- result; HR clears the block from the panel for a genuine device failure.
  retake_unlocked boolean not null default false,
  unlocked_by     text,
  unlocked_at     timestamptz,

  invigilated boolean not null default true,
  notes       text,
  user_agent  text,
  created_at  timestamptz not null default now(),

  -- House style: text + named check, not a Postgres enum (see the rest of hr).
  constraint assessment_attempts_band_check check (
    band is null or band = any (array['STRONG','AVERAGE','WEAK','BELOW_BAR'])
  ),
  constraint assessment_attempts_status_check check (
    status = any (array['in_progress','submitted','expired'])
  ),
  constraint assessment_attempts_score_check check (
    score_total is null or (score_total >= 0 and score_total <= 20)
  )
);

-- One row per (paper, candidate, attempt number). This is what makes a second
-- start with the same email collide instead of quietly creating a duplicate.
create unique index if not exists assessment_attempts_email_attempt_uniq
  on hr.assessment_attempts (assessment_id, email, attempt_no);

-- The token is looked up on every submit — keep it a single index hit.
create unique index if not exists assessment_attempts_token_uniq
  on hr.assessment_attempts (attempt_token);

-- The admin panel's default view: strongest candidates first (§6.3 — a sort
-- order, never a filter).
create index if not exists assessment_attempts_score_idx
  on hr.assessment_attempts (assessment_id, score_total desc nulls last);

create index if not exists assessment_attempts_started_idx
  on hr.assessment_attempts (started_at desc);

alter table hr.assessment_attempts enable row level security;

-- Deliberately no anon policy and no anon grant. The candidate page reaches
-- this table only through the service-role edge function.
revoke all on hr.assessment_attempts from anon;

drop policy if exists "assessment_attempts_hireflow" on hr.assessment_attempts;
create policy "assessment_attempts_hireflow" on hr.assessment_attempts
  for all to authenticated
  using ((select hr.has_hireflow()))
  with check ((select hr.has_hireflow()));
