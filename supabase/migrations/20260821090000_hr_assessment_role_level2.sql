-- ============================================================================
-- Second-level, position-specific assessment.
--
-- HAGERSTONE_DRIVE_AND_ASSESSMENT.md §7.5 reserved this: role-specific
-- technical questions must NOT go on the first-level paper, because all 13
-- positions sit that one. So level 1 (HAG-WALKIN-L1-v5) stays general workplace
-- behaviour, and this adds a SECOND paper per candidate, keyed to the position
-- they applied for (§2.2) — 12 questions, 12 marks, 15 minutes.
--
-- WHY IT REUSES hr.assessment_attempts RATHER THAN A NEW TABLE
-- A level-2 attempt is the same shape as a level-1 one: same anonymous
-- candidate, same email identity, same server-issued token, same server-side
-- marking, same `presented` / `review` snapshot, same retake unlock, and the
-- same HR panel has to show both. A second table would duplicate every one of
-- those and force the panel to union two queries for no gain. What actually
-- differs is WHICH paper was sat, and assessment_id already records that.
--
-- The role papers carry their own ids ('HAG-ROLE-SITE-ENGINEER-v1' etc.), one
-- per position, versioned individually. Because assessment_id is part of
-- assessment_attempts_email_attempt_uniq, one candidate sitting both papers is
-- already two non-colliding rows, and the existing one-attempt-per-paper block
-- and the retake unlock both keep working per paper with no change.
--
-- WHAT THIS MIGRATION ADDS
--   1. position_applied — the position applied for. Level-1 rows have none.
--                      Named with the suffix because bare `position` is a
--                      Postgres function-name keyword and reads ambiguously in
--                      an unquoted expression.
--   2. paper_kind    — 'L1' or 'ROLE'. Denormalised from assessment_id purely
--                      so the panel can filter and index on it without a LIKE.
--   3. section_meta  — the section names and counts of the paper actually sat,
--                      written at start. Level 1 has one fixed set of sections;
--                      the 13 role papers each have their own, so the panel
--                      cannot hardcode them. Storing it on the row is the same
--                      argument as `review`: the attempt stays fully readable
--                      without the panel knowing anything about the bank, and
--                      it stays readable after that paper is bumped to v2.
--   4. the score ceiling moves 25 → 50. Role papers are 12 marks so they fit
--                      today, but see the v2→v3 lesson recorded in
--                      20260819160000: a mark count that outgrows this
--                      constraint fails the submit SILENTLY, and it fails it
--                      for exactly the strongest candidates. Widened once, with
--                      headroom, so the next paper does not need a migration.
--
-- Every column is nullable or defaulted, so every existing level-1 row stays
-- valid and readable and nothing is rewritten.
--
-- Access is unchanged and deliberately so: RLS stays on, anon still has no
-- policy and no grant, and the candidate side still reaches this table only
-- through the `assessment` edge function on the service-role key.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table hr.assessment_attempts
  add column if not exists position_applied text,
  add column if not exists paper_kind   text not null default 'L1',
  add column if not exists section_meta jsonb;

-- House style: text + named check, not a Postgres enum.
alter table hr.assessment_attempts
  drop constraint if exists assessment_attempts_paper_kind_check;

alter table hr.assessment_attempts
  add constraint assessment_attempts_paper_kind_check
  check (paper_kind = any (array['L1','ROLE']));

-- A role attempt is meaningless without the position it was keyed to. Level-1
-- attempts must NOT carry one — the paper is identical for all 13 positions and
-- a position on an L1 row would imply a filter that does not exist.
alter table hr.assessment_attempts
  drop constraint if exists assessment_attempts_position_check;

alter table hr.assessment_attempts
  add constraint assessment_attempts_position_check
  check (
    (paper_kind = 'ROLE' and position_applied is not null)
    or (paper_kind = 'L1' and position_applied is null)
  );

-- 0–25 → 0–50. See the note above; dropped and re-added rather than altered,
-- matching 20260819160000 and the rest of this schema.
alter table hr.assessment_attempts
  drop constraint if exists assessment_attempts_score_check;

alter table hr.assessment_attempts
  add constraint assessment_attempts_score_check
  check (score_total is null or (score_total >= 0 and score_total <= 50));

-- The panel's level-2 view: one position at a time, strongest first (§6.3 — a
-- sort order, never a filter).
create index if not exists assessment_attempts_kind_position_idx
  on hr.assessment_attempts (paper_kind, position_applied, score_total desc nulls last);

-- Pairing a candidate's two papers is by email, and it is the single most
-- common lookup the panel does on a walk-in who has already sat level 1.
create index if not exists assessment_attempts_email_idx
  on hr.assessment_attempts (email);
