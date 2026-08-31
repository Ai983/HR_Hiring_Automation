-- =====================================================================
-- Candidate self-application form  ·  31 Aug 2026
-- ---------------------------------------------------------------------
-- A shareable public link (`/apply.html`) that a candidate fills in
-- themselves. The submission lands in hr.applicants at stage 'new', so it
-- appears in the Kanban board HR already works from — there is deliberately
-- no second inbox to check.
--
-- WHY THESE COLUMNS
-- The form asks for designation, department, location, industry, total
-- experience, skills and notice period. None of those existed on
-- hr.applicants: the table was built for "resume arrived from a portal",
-- where the role is the job you attached them to and everything else is
-- buried in resume_text. A candidate typing their own details gives us
-- structured fields, and stuffing them into screening_notes would make them
-- unsearchable and un-exportable. current_ctc / expected_ctc already exist
-- and are reused as-is (numeric, ₹ lakh per annum).
--
-- WHY job_id BECOMES NULLABLE
-- A self-applying candidate has not applied to a hr.jobs row — they typed a
-- designation. The alternative was auto-creating a job per designation typed,
-- which fills the Jobs panel with one-off junk roles ("Sr. Interior Dsgnr",
-- "interior designer", "Interior Designer ") that then have to be merged by
-- hand. So job_id is left NULL and HR attaches the candidate to a real job
-- when they decide which opening this person is for. The Kanban card falls
-- back to `designation` for its subtitle, so a NULL job_id never renders as
-- "Unknown role".
--
-- WHY portal = 'form'
-- The check constraint is widened rather than reusing 'manual'. 'manual'
-- means "an HR person keyed this in", and the difference matters: a
-- self-reported CTC is the candidate's claim, a manual one has been heard on
-- a call. The source badge has to be able to say which.
--
-- Additive and idempotent. No existing row changes; every new column is
-- nullable so every pre-existing applicant stays readable.
-- =====================================================================

-- ── 1. Structured candidate-supplied profile ────────────────────────────
alter table hr.applicants add column if not exists designation            text;
alter table hr.applicants add column if not exists department             text;
alter table hr.applicants add column if not exists location               text;
alter table hr.applicants add column if not exists industry               text;
alter table hr.applicants add column if not exists total_experience_years numeric;
alter table hr.applicants add column if not exists skills                 jsonb default '[]'::jsonb;
alter table hr.applicants add column if not exists notice_period          text;

comment on column hr.applicants.designation is
  'Role the candidate says they hold / are applying for. Free text — this is NOT hr.jobs.title.';
comment on column hr.applicants.total_experience_years is
  'Self-reported total experience in years. Decimals allowed (1.5 = 18 months).';
comment on column hr.applicants.skills is
  'jsonb array of strings, same shape as hr.jobs.skills.';
comment on column hr.applicants.notice_period is
  'Free text ("Immediate", "30 days", "Serving 60 days"). Deliberately not an
   interval — candidates answer in words and normalising loses "negotiable".';

-- Sanity bounds. A slip of the keyboard on a public form should be rejected
-- at the database, not discovered three weeks later in a CSV export.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'hr.applicants'::regclass
                   and conname  = 'applicants_total_experience_check') then
    alter table hr.applicants
      add constraint applicants_total_experience_check
      check (total_experience_years is null
             or (total_experience_years >= 0 and total_experience_years <= 60));
  end if;

  if not exists (select 1 from pg_constraint
                 where conrelid = 'hr.applicants'::regclass
                   and conname  = 'applicants_skills_is_array_check') then
    alter table hr.applicants
      add constraint applicants_skills_is_array_check
      check (skills is null or jsonb_typeof(skills) = 'array');
  end if;
end $$;

-- ── 2. job_id is now optional ───────────────────────────────────────────
-- The FK and its ON DELETE CASCADE are untouched: an attached candidate is
-- still removed with the job. Only the NOT NULL goes.
alter table hr.applicants alter column job_id drop not null;

-- ── 3. 'form' becomes a valid source ────────────────────────────────────
alter table hr.applicants drop constraint if exists applicants_portal_check;
alter table hr.applicants
  add constraint applicants_portal_check
  check (portal = any (array[
    'linkedin','indeed','jobhai','apna','facebook','instagram',
    'email','whatsapp','manual',
    'form'                       -- candidate self-application via /apply.html
  ]));

-- ── 4. Duplicate lookup ─────────────────────────────────────────────────
-- The edge function checks "have we already got this email?" on every public
-- submit. Without an index that is a seq scan on an anonymous endpoint.
create index if not exists applicants_email_lower_idx
  on hr.applicants (lower(email));

-- RLS is untouched: hr.applicants keeps its single `hireflow_applicants`
-- policy for authenticated callers, and anon still has NO policy and NO
-- grant. The public form writes through the `apply` edge function on the
-- service-role key — the same shape as the walk-in assessment. Do not add
-- an anon policy here.
