-- ============================================================
-- LOCATION TRACKING + GEOFENCED ATTENDANCE SCHEMA
-- Run this in your Supabase SQL Editor (after schema-attendance.sql)
-- Plan: LOCATION-TRACKING-HIREFLOW-PLAN.md
-- ============================================================

-- ── 1. GEOFENCE SITES ───────────────────────────────────────
-- The defined offices/sites. Punch enforcement matches against active rows.
create table if not exists public.geofence_settings (
  id            uuid primary key default gen_random_uuid(),
  site_id       text,                                  -- optional external/site code
  site_name     text not null,
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meters int  not null default 200,
  active        boolean not null default true,
  created_at    timestamptz default now()
);

-- ── 2. LOCATION PINGS ───────────────────────────────────────
-- Every ~30s GPS heartbeat from tracked employees. Read-only surveillance data.
-- latitude/longitude are NULL when GPS is off (site_name = 'GPS_OFF').
create table if not exists public.location_tracking (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  captured_at  timestamptz not null default now(),
  latitude     double precision,
  longitude    double precision,
  accuracy     double precision,
  address      text,
  site_name    text                                    -- matched site | 'Outside' | 'GPS_OFF'
);

create index if not exists idx_loc_emp_time on public.location_tracking(employee_id, captured_at desc);
create index if not exists idx_loc_captured on public.location_tracking(captured_at desc);

-- ── 3. EXTEND ATTENDANCE (additive — keeps existing row-per-event shape) ──
alter table public.attendance
  add column if not exists accuracy          double precision,
  add column if not exists site_id           text,
  add column if not exists site_name         text,
  add column if not exists location_verified boolean default true;

-- ── 4. OPT-OUT / OPT-IN FLAG ────────────────────────────────
-- Per-employee kill switch. Defaults FALSE so nobody is tracked until an
-- admin opts them in (site/field staff first). Office/admin stay untracked.
alter table public.employees
  add column if not exists track_location boolean not null default false;

-- Optional seed for field roles (uncomment + adjust after review):
-- update public.employees set track_location = true
--   where designation ilike '%site%'
--      or designation ilike '%project manager%'
--      or department  ilike '%site%';

-- ── 5. ROW LEVEL SECURITY (open, matching this repo's other tables) ──
alter table public.geofence_settings enable row level security;
alter table public.location_tracking enable row level security;

drop policy if exists "allow_all_geofence" on public.geofence_settings;
drop policy if exists "allow_all_loc"      on public.location_tracking;

create policy "allow_all_geofence" on public.geofence_settings for all using (true) with check (true);
create policy "allow_all_loc"      on public.location_tracking  for all using (true) with check (true);

-- ── 6. 60-DAY AUTO-PURGE ────────────────────────────────────
-- Option A (pg_cron — requires the extension enabled on your project):
--   select cron.schedule(
--     'purge_location_tracking', '0 3 * * *',
--     $$ delete from public.location_tracking where captured_at < now() - interval '60 days' $$
--   );
-- Option B: call this manually / from an existing n8n daily cron:
create or replace function public.purge_old_location_pings()
returns void language sql as $$
  delete from public.location_tracking where captured_at < now() - interval '60 days';
$$;

-- ============================================================
-- DONE. Verify:  select * from public.geofence_settings;
-- ============================================================
