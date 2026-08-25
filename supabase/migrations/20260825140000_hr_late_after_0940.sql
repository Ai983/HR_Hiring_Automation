-- ============================================================================
-- hr_late_after_0940
--
-- The late cut-off becomes 09:40. Anyone past it is marked Late.
--
-- 09:30 was set earlier the same day (20260825120000) to match the printed
-- HSIPL sheet, but on real data it made six of the fifteen office staff
-- structurally late — median arrival 10:13 to 10:41 — which reads as a
-- different agreed start time rather than lateness. The EA's call on
-- 2026-08-25: 09:40, and no further leniency past it.
--
-- Still compared at MINUTE granularity (20260825130000), so 09:40:59 is on
-- time and 09:41:00 is late.
--
-- hr.attendance_day is a view, so this re-scores all history the moment it is
-- applied. It also means the report no longer reproduces the sample PDF's
-- 19 On Time / 5 Late for Deepak Bansal in July 2026 — at 09:40 the same month
-- is 22 / 2. That is the intended consequence of changing the rule, and
-- scripts/verify-office-team-report.mjs is updated to match.
-- ============================================================================

update hr.attendance_settings
   set late_after = '09:40', updated_at = now()
 where id;
