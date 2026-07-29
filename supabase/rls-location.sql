-- ============================================================================
--  RLS HARDENING — attendance / location tables ONLY
--  Project: Hub (tpfvnerrjhqwipyonngf), schema `hr`
--
--  SCOPE: touches ONLY these 4 tables. No other hr.* table, no public.* table,
--  no other Hub module is affected — RLS is evaluated per-table.
--
--  WHAT IT DOES:
--    • Turns on Row Level Security (default-deny) on the 4 tables.
--    • Re-permits the `authenticated` role (logged-in Hub users) — so the app
--      keeps working exactly as today.
--    • Leaves `anon` (logged-out / raw anon key) DENIED — closes the hole.
--    • Edge Functions use the service-role key, which BYPASSES RLS, so punch
--      writes and notifications are unaffected.
--
--  SAFE TO RE-RUN. Reversible: see the rollback block at the bottom.
-- ============================================================================

-- ── geofence_settings ──────────────────────────────────────────────────────
alter table hr.geofence_settings enable row level security;
drop policy if exists "auth_all_geofence" on hr.geofence_settings;
create policy "auth_all_geofence" on hr.geofence_settings
  for all to authenticated using (true) with check (true);

-- ── location_tracking ──────────────────────────────────────────────────────
alter table hr.location_tracking enable row level security;
drop policy if exists "auth_all_location" on hr.location_tracking;
create policy "auth_all_location" on hr.location_tracking
  for all to authenticated using (true) with check (true);

-- ── attendance ─────────────────────────────────────────────────────────────
alter table hr.attendance enable row level security;
drop policy if exists "auth_all_attendance" on hr.attendance;
create policy "auth_all_attendance" on hr.attendance
  for all to authenticated using (true) with check (true);

-- ── employee_profile (holds track_location, pin, roster) ───────────────────
alter table hr.employee_profile enable row level security;
drop policy if exists "auth_all_profile" on hr.employee_profile;
create policy "auth_all_profile" on hr.employee_profile
  for all to authenticated using (true) with check (true);


-- ============================================================================
--  VERIFY — RLS on, one policy each, anon has none
-- ============================================================================
select 'RLS STATUS' as check, relname as table_name, relrowsecurity as rls_on
from pg_class
where relnamespace = 'hr'::regnamespace
  and relname in ('geofence_settings','location_tracking','attendance','employee_profile')
order by relname;

select 'POLICIES' as check, tablename, policyname, roles
from pg_policies
where schemaname = 'hr'
  and tablename in ('geofence_settings','location_tracking','attendance','employee_profile')
order by tablename;


-- ============================================================================
--  ROLLBACK (only if something misbehaves) — turns RLS back off on these 4:
--
--    alter table hr.geofence_settings disable row level security;
--    alter table hr.location_tracking disable row level security;
--    alter table hr.attendance        disable row level security;
--    alter table hr.employee_profile  disable row level security;
-- ============================================================================
