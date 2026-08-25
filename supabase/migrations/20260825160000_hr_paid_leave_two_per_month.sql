-- ============================================================================
-- hr_paid_leave_two_per_month
--
-- The paid-leave allowance is 2 days a month, not 2.5.
--
-- 2.5 came from the HSIPL sheet's "Allowed Leaves" column and was carried in
-- by 20260730060404 without anyone confirming it against policy. The EA
-- corrected it on 2026-08-25: the entitlement is 2.
--
-- Changed in all four places it is stated, because a half-day difference in
-- any one of them shows up as a wrong "Pending Leaves" figure and nobody would
-- know which number to believe:
--   1. the column default on hr.employee_profile
--   2. the 19 existing rows, none of which had been set individually
--   3. the fallback in hr.attendance_subject, used for anyone with no profile
--   4. (in the app) leaveConfig.PAID_LEAVE_PER_MONTH and the leaveService and
--      EmployeeManagement fallbacks
--
-- Per-person overrides still work: EmployeeManagement writes
-- allowed_leaves_per_month directly, and anyone already carrying a bespoke
-- value would be left alone by the WHERE below. Today nobody is — all 19 rows
-- hold the inherited 2.5 — so all 19 move to 2.
-- ============================================================================

alter table hr.employee_profile
  alter column allowed_leaves_per_month set default 2;

-- Only the rows still carrying the old inherited value. A deliberate
-- per-person allowance of some other number is not touched.
update hr.employee_profile
   set allowed_leaves_per_month = 2, updated_at = now()
 where allowed_leaves_per_month = 2.5;

create or replace view hr.attendance_subject as
  select e.id                                   as subject_id,
         'employee'::text                       as subject_kind,
         e.id                                   as employee_id,
         null::uuid                             as person_ref,
         e.full_name,
         e.employee_code,
         e.department,
         coalesce(p.planned_days_per_week, 6)   as planned_days_per_week,
         coalesce(p.works_sunday, false)        as works_sunday,
         coalesce(p.allowed_leaves_per_month, 2) as allowed_leaves_per_month,
         e.is_active,
         coalesce(p.office_team, false)         as office_team
  from hr.employees e
  left join hr.employee_profile p on p.employee_id = e.id
  union all
  select ap.id, 'roster', null::uuid, ap.id, ap.full_name, null, null,
         ap.planned_days_per_week, ap.works_sunday, 0::numeric, ap.active, false
  from hr.attendance_person ap
  where ap.employee_id is null;

alter view hr.attendance_subject set (security_invoker = true);
grant select on hr.attendance_subject to authenticated;
