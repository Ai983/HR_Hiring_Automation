-- ============================================================================
-- RLS helper calls become InitPlans instead of per-row calls.
--
-- SYMPTOM
-- -------
-- "My Attendance" in the employee portal showed
--   canceling statement due to statement timeout
-- and rendered all-zero tiles (Yogesh Singh, HAG-054, August 2026). The same
-- month reads in ~0.4s with the service-role key, which is the tell: the data
-- and the views are fine, RLS is what costs the time.
--
-- CAUSE
-- -----
-- The policies from rls-hardening-golive.sql call the helper functions bare:
--
--   using (employee_id = hr.my_employee_id() or hr.is_hr_admin())
--
-- The OR is what makes this expensive. `employee_id = hr.my_employee_id()`
-- alone is indexable, and the planner would evaluate the STABLE function once
-- as a scan bound. OR-ed with `hr.is_hr_admin()` -- which no index can answer
-- -- the whole thing degrades to a seq scan with a filter, and in a filter
-- both functions are re-executed for EVERY row. Each is a security-definer
-- function that queries public.employees.
--
-- So reading one employee's month costs, per query:
--
--   17,697 hr.attendance rows, seq-scanned to produce the 6 that are his
--     x ~2 helper calls each (the OR short-circuits only on his own rows)
--     = ~35k security-definer invocations
--   + hr.leave_requests (911 rows) re-scanned per spine day by the LATERAL
--     in hr.attendance_day, ~2 helper calls per row
--
-- and the portal fires two such queries in parallel (attendance_day and
-- attendance_month). That lands on the 8s statement_timeout the
-- `authenticated` role runs under -- consistent with the failure being
-- intermittent rather than absolute. The service role bypasses RLS entirely,
-- which is why this never showed up in admin testing.
--
-- Wrapped in a scalar sub-select the call becomes an InitPlan: Postgres runs
-- it once per statement and reuses the value.
--
-- FIX
-- ---
-- Re-create every hr policy with the helper call wrapped in `(select ...)`.
-- The access model is UNCHANGED -- same functions, same conditions, same
-- who-can-see-what. Only the number of times Postgres evaluates them changes.
-- The seq scan on hr.attendance stays (nothing here makes the OR indexable);
-- what disappears is the ~35k function invocations layered on top of it.
--
-- MEASURED, as HAG-054 under RLS, Aug 2026 (explain analyze, before -> after):
--   hr.attendance_month   2389.7 ms -> 5.4 ms
--   hr.attendance_day     2371.6 ms -> 6.3 ms
-- Filter went from `employee_id = hr.my_employee_id() OR hr.is_hr_admin()`
-- to `employee_id = (InitPlan 1).col1 OR (InitPlan 2).col1`.
-- HR-admin today board (sees all 151 subjects): 85 ms.
--
-- Access re-verified after applying, by impersonating real accounts:
--   employee  -> own rows only; 0 rows from others' attendance/leave/applicants
--   employee  -> may punch for self, blocked punching as someone else
--   HR admin  -> still sees all 17,697 punches / 911 leaves / 48 applicants
--   leave decision: EA 1 row, non-EA HR 0 rows, employee 0 rows
--
-- Applied to production (tpfvnerrjhqwipyonngf) 2026-08-19 as migration
-- 20260819062423. Idempotent: safe to re-run.
-- ============================================================================

-- ── attendance ──────────────────────────────────────────────────────────────
drop policy if exists "attendance_self_read"  on hr.attendance;
create policy "attendance_self_read"  on hr.attendance for select to authenticated
  using (employee_id = (select hr.my_employee_id()) or (select hr.is_hr_admin()));

drop policy if exists "attendance_self_write" on hr.attendance;
create policy "attendance_self_write" on hr.attendance for insert to authenticated
  with check (employee_id = (select hr.my_employee_id()) or (select hr.is_hr_admin()));

drop policy if exists "attendance_admin_edit" on hr.attendance;
create policy "attendance_admin_edit" on hr.attendance for update to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

drop policy if exists "attendance_admin_del"  on hr.attendance;
create policy "attendance_admin_del"  on hr.attendance for delete to authenticated
  using ((select hr.is_hr_admin()));

-- ── location_tracking ───────────────────────────────────────────────────────
drop policy if exists "location_self_read"  on hr.location_tracking;
create policy "location_self_read"  on hr.location_tracking for select to authenticated
  using (employee_id = (select hr.my_employee_id()) or (select hr.is_hr_admin()));

drop policy if exists "location_self_write" on hr.location_tracking;
create policy "location_self_write" on hr.location_tracking for insert to authenticated
  with check (employee_id = (select hr.my_employee_id()) or (select hr.is_hr_admin()));

drop policy if exists "location_admin_del"  on hr.location_tracking;
create policy "location_admin_del"  on hr.location_tracking for delete to authenticated
  using ((select hr.is_hr_admin()));

-- ── leave_requests ──────────────────────────────────────────────────────────
-- The LATERAL in hr.attendance_day hits this table once per spine day, so this
-- is the single biggest win in the file.
drop policy if exists "leave_self_read"   on hr.leave_requests;
create policy "leave_self_read"   on hr.leave_requests for select to authenticated
  using (employee_id = (select hr.my_employee_id()) or (select hr.is_hr_admin()));

drop policy if exists "leave_self_insert" on hr.leave_requests;
create policy "leave_self_insert" on hr.leave_requests for insert to authenticated
  with check (employee_id = (select hr.my_employee_id()));

-- approval stays EA-only -- see 20260818093922_hr_leave_approval_ea_only.sql
drop policy if exists "leave_approver_edit" on hr.leave_requests;
create policy "leave_approver_edit" on hr.leave_requests for update to authenticated
  using ((select hr.is_leave_approver())) with check ((select hr.is_leave_approver()));

drop policy if exists "leave_admin_del"   on hr.leave_requests;
create policy "leave_admin_del"   on hr.leave_requests for delete to authenticated
  using ((select hr.is_hr_admin()));

-- ── employee_profile ────────────────────────────────────────────────────────
drop policy if exists "profile_read"  on hr.employee_profile;
create policy "profile_read"  on hr.employee_profile for select to authenticated
  using (employee_id = (select hr.my_employee_id()) or (select hr.is_hr_admin()));

drop policy if exists "profile_write" on hr.employee_profile;
create policy "profile_write" on hr.employee_profile for all to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

-- ── geofence_settings ───────────────────────────────────────────────────────
drop policy if exists "geofence_write" on hr.geofence_settings;
create policy "geofence_write" on hr.geofence_settings for all to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

-- ── attendance reference tables (from the HSIPL parity migration) ───────────
drop policy if exists sites_write on hr.sites;
create policy sites_write on hr.sites for all to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

drop policy if exists holidays_write on hr.holidays;
create policy holidays_write on hr.holidays for all to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

drop policy if exists settings_write on hr.attendance_settings;
create policy settings_write on hr.attendance_settings for all to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

drop policy if exists person_admin on hr.attendance_person;
create policy person_admin on hr.attendance_person for all to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

drop policy if exists remarks_admin on hr.attendance_remarks;
create policy remarks_admin on hr.attendance_remarks for all to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

-- ── hiring tables: same per-row problem, and has_hireflow() is the most
--    expensive of the helpers (three sub-selects and two joins) ─────────────
do $$
declare t text;
begin
  foreach t in array array['jobs','applicants','call_logs','interviews','references',
                           'offers','joinings','documents','questionnaires','survey_responses'] loop
    execute format('drop policy if exists "hireflow_%s" on hr.%I', t, t);
    execute format('create policy "hireflow_%s" on hr.%I for all to authenticated
                    using ((select hr.has_hireflow()))
                    with check ((select hr.has_hireflow()))', t, t);
  end loop;
end $$;

-- ── VERIFY: every remaining row here is a policy still calling a helper
--    outside a sub-select. Expect zero rows. ────────────────────────────────
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'hr'
  and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(?<!select )hr\.(my_employee_id|is_hr_admin|has_hireflow|is_leave_approver)\(\)';
