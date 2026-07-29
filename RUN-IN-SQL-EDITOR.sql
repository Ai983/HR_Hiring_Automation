-- ============================================================================
--  LOCATION TRACKING + GEOFENCED ATTENDANCE  —  RUN THIS IN SUPABASE SQL EDITOR
--  Project: Hiring System (sgerslbmnwrltqrhsdir)
--
--  HOW TO RUN:
--    1. Supabase Dashboard -> SQL Editor -> New query
--    2. Paste this ENTIRE file
--    3. Click "Run"
--    4. Scroll to the bottom output to see the verification results
--
--  SAFE TO RE-RUN: every statement uses "if not exists" / "or replace",
--  so running it twice changes nothing and destroys no data.
-- ============================================================================


-- ─── 1. GEOFENCE SITES ──────────────────────────────────────────────────────
-- Your authorised offices/sites. Punches are matched against ACTIVE rows.
create table if not exists public.geofence_settings (
  id            uuid primary key default gen_random_uuid(),
  site_id       text,                                  -- optional site code, e.g. "HO-01"
  site_name     text not null,
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meters int  not null default 200,
  active        boolean not null default true,
  created_at    timestamptz default now()
);


-- ─── 2. LOCATION PINGS ──────────────────────────────────────────────────────
-- The ~30s GPS heartbeat from tracked employees.
-- lat/lng are NULL when GPS is off (site_name = 'GPS_OFF').
create table if not exists public.location_tracking (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  captured_at  timestamptz not null default now(),
  latitude     double precision,
  longitude    double precision,
  accuracy     double precision,
  address      text,
  site_name    text                                    -- site name | 'Outside' | 'GPS_OFF'
);

create index if not exists idx_loc_emp_time on public.location_tracking(employee_id, captured_at desc);
create index if not exists idx_loc_captured on public.location_tracking(captured_at desc);


-- ─── 3. EXTEND THE EXISTING ATTENDANCE TABLE ────────────────────────────────
-- Additive only. Your existing rows and the check_in/check_out shape are untouched.
alter table public.attendance
  add column if not exists accuracy          double precision,
  add column if not exists site_id           text,
  add column if not exists site_name         text,
  add column if not exists location_verified boolean default true;


-- ─── 4. PER-EMPLOYEE TRACKING SWITCH ────────────────────────────────────────
-- Defaults to FALSE, so NOBODY is tracked until you switch them on
-- (Employees panel -> Edit -> "Enable location tracking").
alter table public.employees
  add column if not exists track_location boolean not null default false;


-- ─── 5. ROW LEVEL SECURITY ──────────────────────────────────────────────────
-- Open policies, matching how employees/attendance are already configured
-- in this project (the app uses PIN login, not Supabase Auth).
alter table public.geofence_settings enable row level security;
alter table public.location_tracking enable row level security;

drop policy if exists "allow_all_geofence" on public.geofence_settings;
drop policy if exists "allow_all_loc"      on public.location_tracking;

create policy "allow_all_geofence" on public.geofence_settings for all using (true) with check (true);
create policy "allow_all_loc"      on public.location_tracking  for all using (true) with check (true);


-- ─── 6. SELFIE STORAGE BUCKET ───────────────────────────────────────────────
-- The attendance portal uploads selfies here. Harmless if it already exists.
insert into storage.buckets (id, name, public)
  values ('selfies', 'selfies', true)
  on conflict (id) do nothing;

drop policy if exists "allow_all_selfies" on storage.objects;
create policy "allow_all_selfies" on storage.objects
  for all using (bucket_id = 'selfies') with check (bucket_id = 'selfies');


-- ─── 7. PING CLEANUP (60-day retention) ─────────────────────────────────────
-- Keeps location_tracking from growing forever. Call it from a scheduled job,
-- or just run "select public.purge_old_location_pings();" manually now and then.
create or replace function public.purge_old_location_pings()
returns void language sql as $$
  delete from public.location_tracking where captured_at < now() - interval '60 days';
$$;

-- OPTIONAL — fully automatic daily cleanup at 3am (needs the pg_cron extension,
-- enable it under Database -> Extensions first). Uncomment to use:
--
-- select cron.schedule(
--   'purge_location_tracking',
--   '0 3 * * *',
--   $$ delete from public.location_tracking where captured_at < now() - interval '60 days' $$
-- );


-- ============================================================================
--  8. OPTIONAL — ADD YOUR FIRST SITE
--  Replace the name/coordinates with your real office, then uncomment.
--  Tip: get coordinates from Google Maps (right-click a spot -> copy lat,lng),
--  or just use the "Use my current location" button in the Geofence Sites panel.
-- ============================================================================
--
-- insert into public.geofence_settings (site_name, site_id, latitude, longitude, radius_meters, active)
-- values ('Head Office', 'HO-01', 28.613900, 77.209000, 200, true);


-- ============================================================================
--  9. VERIFICATION — these run automatically and show the results
-- ============================================================================

-- 9a. Confirm the new tables exist
select 'TABLES' as check, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('geofence_settings', 'location_tracking')
order by table_name;

-- 9b. Confirm the new attendance columns exist (expect 4 rows)
select 'ATTENDANCE COLS' as check, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'attendance'
  and column_name in ('accuracy', 'site_id', 'site_name', 'location_verified')
order by column_name;

-- 9c. Confirm the employees.track_location flag exists (expect 1 row)
select 'EMPLOYEE FLAG' as check, column_name, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'employees'
  and column_name = 'track_location';

-- 9d. How many sites and tracked employees you currently have
select 'COUNTS' as check,
       (select count(*) from public.geofence_settings where active) as active_sites,
       (select count(*) from public.employees where track_location) as tracked_employees;

-- ============================================================================
--  EXPECTED RESULT: 2 tables, 4 attendance columns, 1 employee flag,
--  and counts of 0 / 0 (you add sites + enable employees from the app UI).
--
--  ⚠️ ONE MORE STEP AFTER THIS — see DEPLOY-NOTES.md
--     The "attendance-punch" Edge Function must also be deployed, or
--     check-in/check-out will stop working.
-- ============================================================================
