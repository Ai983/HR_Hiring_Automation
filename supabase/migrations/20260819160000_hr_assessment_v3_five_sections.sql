-- ============================================================================
-- Assessment v3: a fifth section, and a 25-mark paper.
--
-- HAG-WALKIN-L1-v2 was 20 marks across four sections. v3 is 25 marks across
-- five, because the paper was rebuilt to test situational judgement, procedure
-- and client handling rather than site vocabulary and arithmetic:
--
--   A Site Execution & Sequencing   5
--   B Client & Stakeholder Handling 6
--   C Procedure & Documentation     6
--   D Commercial Judgement          4
--   E Safety & Problem Diagnosis    4
--
-- Two changes are needed for that to be storable:
--
--   1. score_section_e — the new column. Nullable, because every v2 attempt
--      that already exists legitimately has no Section E and must stay
--      readable and re-markable (§7.3).
--   2. the score_total ceiling moves 20 → 25. The old constraint would have
--      rejected any paper scoring 21 or more, silently failing the submit for
--      exactly the strongest candidates.
--
-- Nothing here is destructive and no v2 row is rewritten. assessment_id is what
-- tells the two versions apart, and scores across versions are not comparable.
--
-- Applied to the hub project (tpfvnerrjhqwipyonngf) on 2026-08-19.
-- Idempotent: safe to re-run.
-- ============================================================================

alter table hr.assessment_attempts
  add column if not exists score_section_e integer;

-- 0–20 → 0–25. Dropped and re-added rather than altered, matching the house
-- pattern for widening a check constraint elsewhere in this schema.
alter table hr.assessment_attempts
  drop constraint if exists assessment_attempts_score_check;

alter table hr.assessment_attempts
  add constraint assessment_attempts_score_check
  check (score_total is null or (score_total >= 0 and score_total <= 25));
