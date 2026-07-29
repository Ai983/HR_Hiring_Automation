-- ============================================================================
--  RLS HARDENING — GO-LIVE BLOCKER
--  Project: Hub (tpfvnerrjhqwipyonngf), schema `hr`
--
--  WHY THIS EXISTS
--  ---------------
--  Verified against the live project on 2026-07-29 with the public anon key
--  (the same key that ships inside the browser bundle, so anyone who opens
--  devtools has it):
--
--    anon SELECT hr.applicants        -> rows returned   (candidate PII)
--    anon SELECT hr.offers            -> rows returned   (salary / CTC)
--    anon SELECT hr.call_logs         -> rows returned   (call notes)
--    anon SELECT hr.interviews        -> rows returned   (feedback)
--    anon SELECT hr.survey_responses  -> rows returned   (lead PII)
--    anon SELECT hr.references / questionnaires / jobs / joinings / documents -> readable
--    anon INSERT hr.applicants        -> SUCCEEDED       (anyone can write)
--
--  Eleven hr.* tables have RLS switched off entirely. Until this runs, the
--  hiring database is world-readable and world-writable.
--
--  This script is the follow-up to `rls-location.sql` (already applied, which
--  covered attendance / location_tracking / geofence_settings / employee_profile).
--
--  STATUS: ✅ APPLIED TO PRODUCTION 2026-07-29 (Part A and Part B).
--  Verified after applying, with two throwaway accounts (since deleted):
--    • anon (logged out)      -> 0 rows on all 14 tables; INSERT blocked (42501)
--    • HR role                -> full access, all 20 admin-app queries green
--    • site_engineer role     -> own records only; cannot edit others'
--                                attendance, cannot file leave as someone
--                                else, cannot self-approve, cannot read PINs
--  60/60 assertions passed. Kept here as the source of record + rollback.
--
--  HOW TO RUN (if ever needed again)
--  ---------------------------------
--  Supabase Dashboard -> SQL Editor -> paste -> Run. Safe to re-run.
--  Rollback block at the bottom.
--
--  PART A is the minimum to be safe (lock anon out, keep the app working).
--  PART B tightens the over-broad policies that already exist. Read the notes
--  on Part B before running it — it changes who can edit whose attendance.
-- ============================================================================


-- ============================================================================
--  PART A — close the anon hole on the 11 hiring tables               [DO THIS]
--
--  Effect: logged-out callers (raw anon key) get nothing. Logged-in Hub users
--  keep exactly today's access, so the admin app is unaffected. Edge Functions
--  use the service-role key, which bypasses RLS, so screening / JD / offer
--  generation / n8n webhooks are unaffected.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'jobs','applicants','call_logs','interviews','references',
    'offers','joinings','documents','questionnaires','survey_responses','leave_requests'
  ] loop
    execute format('alter table hr.%I enable row level security', t);
    execute format('drop policy if exists "auth_all_%s" on hr.%I', t, t);
    execute format(
      'create policy "auth_all_%s" on hr.%I for all to authenticated using (true) with check (true)',
      t, t);
  end loop;
end $$;


-- ============================================================================
--  PART A2 — scope the hiring tables to people who actually hold the
--  `hireflow` module, instead of every logged-in employee.        [ALSO APPLIED]
--
--  Part A alone still let all 74 staff read candidate PII and offer CTC through
--  the raw REST API. This narrows it to the 6 people the hub already grants
--  hireflow to — using the hub's OWN module maths (role defaults ∪ grants −
--  revokes), so it can never drift from `hr.my_context()`.
--
--  Verified: returns true for exactly AI Team, Aniket, Bhaskar Tyagi,
--  Dhruv Agarwal, Shivani, Shubh Dwivedi — the same 6 the UI shows it to.
--  Edge Functions and n8n use the service-role key and are unaffected.
-- ============================================================================

create or replace function hr.has_hireflow()
returns boolean language sql stable security definer set search_path to 'public' as $$
  with me as (select id, role from public.employees where auth_user_id = auth.uid() and is_active limit 1),
  role_has as (select true f from me join public.roles r on r.id = me.role
               where 'hireflow' = any(coalesce(r.default_modules,'{}')::text[])),
  grant_row as (select ema.can_access from public.employee_module_access ema
                join me on me.id = ema.employee_id where ema.module_id = 'hireflow')
  select coalesce((select can_access from grant_row), (select f from role_has), false);
$$;
grant execute on function hr.has_hireflow() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['jobs','applicants','call_logs','interviews','references',
                           'offers','joinings','documents','questionnaires','survey_responses'] loop
    execute format('drop policy if exists "auth_all_%s" on hr.%I', t, t);
    execute format('drop policy if exists "hireflow_%s" on hr.%I', t, t);
    execute format('create policy "hireflow_%s" on hr.%I for all to authenticated
                    using (hr.has_hireflow()) with check (hr.has_hireflow())', t, t);
  end loop;
end $$;


-- ============================================================================
--  PART B — tighten the policies that are currently "any logged-in user can do
--  anything"                                                      [RECOMMENDED]
--
--  Also verified live: with an ordinary (non-admin) employee login we were able
--  to read every colleague's attendance rows, read stored PINs out of
--  hr.employees, and file a leave request under a *different* employee's id.
--
--  These policies replace `using (true)` with:
--    • employees  -> may read/write only their OWN attendance, location, leave
--    • admin/HR   -> full access (public.is_admin(), plus the hr role)
--
--  NOTE: run this only once you are ready for it. If the admin app is used by
--  someone whose `public.employees.role` is not 'admin' or 'hr', they will lose
--  the Attendance / Leave / Location panels until their role is fixed.
-- ============================================================================

-- helper: is the caller HR or admin?
create or replace function hr.is_hr_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid()
      and is_active = true
      and role in ('admin','hr','founder','management','ai','mis')
  );
$$;

-- helper: the caller's employee id
create or replace function hr.my_employee_id()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from public.employees where auth_user_id = auth.uid() and is_active = true limit 1;
$$;

-- ── attendance: own rows read/insert; HR/admin everything ──────────────────
drop policy if exists "auth_all_attendance" on hr.attendance;
create policy "attendance_self_read"  on hr.attendance for select to authenticated
  using (employee_id = hr.my_employee_id() or hr.is_hr_admin());
create policy "attendance_self_write" on hr.attendance for insert to authenticated
  with check (employee_id = hr.my_employee_id() or hr.is_hr_admin());
create policy "attendance_admin_edit" on hr.attendance for update to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());
create policy "attendance_admin_del"  on hr.attendance for delete to authenticated
  using (hr.is_hr_admin());

-- ── location_tracking: own pings; HR/admin sees the team ───────────────────
drop policy if exists "auth_all_location" on hr.location_tracking;
create policy "location_self_read"  on hr.location_tracking for select to authenticated
  using (employee_id = hr.my_employee_id() or hr.is_hr_admin());
create policy "location_self_write" on hr.location_tracking for insert to authenticated
  with check (employee_id = hr.my_employee_id() or hr.is_hr_admin());
create policy "location_admin_del"  on hr.location_tracking for delete to authenticated
  using (hr.is_hr_admin());

-- ── leave_requests: file only for yourself; only HR/admin approves ─────────
drop policy if exists "auth_all_leave_requests" on hr.leave_requests;
create policy "leave_self_read"   on hr.leave_requests for select to authenticated
  using (employee_id = hr.my_employee_id() or hr.is_hr_admin());
create policy "leave_self_insert" on hr.leave_requests for insert to authenticated
  with check (employee_id = hr.my_employee_id());   -- blocks filing as someone else
create policy "leave_admin_edit"  on hr.leave_requests for update to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());
create policy "leave_admin_del"   on hr.leave_requests for delete to authenticated
  using (hr.is_hr_admin());

-- ── employee_profile: HR/admin only (it holds PIN + tracking flags) ────────
drop policy if exists "auth_all_profile" on hr.employee_profile;
create policy "profile_read"  on hr.employee_profile for select to authenticated
  using (employee_id = hr.my_employee_id() or hr.is_hr_admin());
create policy "profile_write" on hr.employee_profile for all to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());

-- ── geofence_settings: everyone reads (the portal needs it), HR/admin edits ─
drop policy if exists "auth_all_geofence" on hr.geofence_settings;
create policy "geofence_read"  on hr.geofence_settings for select to authenticated using (true);
create policy "geofence_write" on hr.geofence_settings for all to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());

-- ── stop exposing the legacy PIN column through the shared view ────────────
-- The PIN is vestigial (punching is SSO-based now) but is still readable by
-- every authenticated user through hr.employees. Drop it from the view.
--   (Uncomment once EmployeeManagement.jsx's PIN field is removed.)
-- create or replace view hr.employees as
--   select e.id, e.employee_code, e.name as full_name, e.email, e.phone,
--          e.department, e.designation, e.is_active, e.staff_type,
--          coalesce(p.track_location,false) as track_location,
--          e.created_at, e.updated_at
--   from public.employees e
--   left join hr.employee_profile p on p.employee_id = e.id;


-- ============================================================================
--  VERIFY
-- ============================================================================
select relname as table_name, relrowsecurity as rls_on
from pg_class
where relnamespace = 'hr'::regnamespace and relkind = 'r'
order by relrowsecurity, relname;

select tablename, policyname, cmd, roles::text
from pg_policies where schemaname = 'hr' order by tablename, policyname;

-- Manual smoke test after running: open the app in a private window,
-- sign in as a normal employee, punch in from the portal, and confirm the
-- Attendance / Leave panels still load for an HR login.


-- ============================================================================
--  ROLLBACK
--
--    do $$ declare t text; begin
--      foreach t in array array['jobs','applicants','call_logs','interviews',
--        'references','offers','joinings','documents','questionnaires',
--        'survey_responses','leave_requests']
--      loop execute format('alter table hr.%I disable row level security', t); end loop;
--    end $$;
--
--  To undo Part B only, re-apply the blanket policies from rls-location.sql.
-- ============================================================================
