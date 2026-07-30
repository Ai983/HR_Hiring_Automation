-- ============================================================================
-- Brings hr attendance to parity with the retired "Staff Attendance System
-- (HSIPL)" Google Sheet. EVERYTHING here lives in the `hr` schema.
-- No other schema is read for writes, created, altered or dropped.
-- ============================================================================

-- ── 1. Site master: the 47-entry dropdown the old form had ──────────────────
create table if not exists hr.sites (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  code           text,
  latitude       double precision,          -- optional: enables the GPS cross-check
  longitude      double precision,
  radius_meters  integer not null default 500,
  active         boolean not null default true,
  created_at     timestamptz default now()
);
create index if not exists sites_active_idx on hr.sites (active, name);

-- ── 2. HR-only person roster ────────────────────────────────────────────────
-- For the 40 names in the sheet with no hub account, plus any name whose hub
-- identity is ambiguous. Deliberately NOT public.employees: that master is
-- shared with CPS / Finance / LCS / Delegation and must stay untouched.
-- employee_id is a nullable link, to be filled in later once accounts exist.
create table if not exists hr.attendance_person (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null unique,
  employee_id           uuid references employees(id) on delete set null,
  active                boolean not null default true,
  planned_days_per_week integer not null default 6,
  works_sunday          boolean not null default false,
  note                  text,
  created_at            timestamptz default now()
);
create index if not exists attendance_person_emp_idx on hr.attendance_person (employee_id);

-- ── 3. Holiday calendar (Setting tab) ───────────────────────────────────────
create table if not exists hr.holidays (
  holiday_date date primary key,
  name         text not null,
  created_at   timestamptz default now()
);

-- ── 4. Shift / OT / weekend configuration (was hardcoded in sheet formulas) ─
create table if not exists hr.attendance_settings (
  id                 boolean primary key default true check (id),   -- singleton
  shift_start        time not null default '08:00',
  shift_end          time not null default '19:00',
  late_after         time not null default '09:30',
  full_day_minutes   integer not null default 540,   -- 9h
  half_day_minutes   integer not null default 240,   -- 4h
  ot_after_minutes   integer not null default 540,   -- OT past 9h
  weekend_dows       integer[] not null default '{0}',  -- 0 = Sunday
  updated_at         timestamptz default now()
);
insert into hr.attendance_settings (id) values (true) on conflict (id) do nothing;

-- ── 5. Per-person work rules for hub employees ──────────────────────────────
alter table hr.employee_profile
  add column if not exists planned_days_per_week   integer not null default 6,
  add column if not exists works_sunday            boolean not null default false,
  add column if not exists allowed_leaves_per_month numeric not null default 2.5;

-- ── 6. Extend the punch row ─────────────────────────────────────────────────
alter table hr.attendance
  add column if not exists site_ref        uuid references hr.sites(id),
  add column if not exists person_ref      uuid references hr.attendance_person(id) on delete cascade,
  add column if not exists source          text not null default 'portal',
  add column if not exists site_match      text,
  add column if not exists site_distance_m numeric,
  add column if not exists photo_url       text;

-- employee_id must become nullable so imported history for roster-only people
-- can be stored. Exactly one of employee_id / person_ref must be set.
alter table hr.attendance alter column employee_id drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_subject_chk') then
    alter table hr.attendance add constraint attendance_subject_chk
      check ((employee_id is not null) <> (person_ref is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_source_chk') then
    alter table hr.attendance add constraint attendance_source_chk
      check (source in ('portal','import','admin','kiosk'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_site_match_chk') then
    alter table hr.attendance add constraint attendance_site_match_chk
      check (site_match is null or site_match in ('ok','mismatch','no_coords','no_gps'));
  end if;
end $$;

create index if not exists attendance_person_ref_idx on hr.attendance (person_ref, recorded_at desc);
create index if not exists attendance_day_idx on hr.attendance ((recorded_at at time zone 'Asia/Kolkata'));

-- ── 7. Leave codes the sheet used but the app lacked: SHL and UL ────────────
alter table hr.leave_requests drop constraint if exists leave_type_check;
alter table hr.leave_requests add constraint leave_type_check
  check (leave_type in ('casual','half_day','emergency','sick','short_leave','uninformed'));

-- ── 8. Monthly remarks (Remarks tab) ────────────────────────────────────────
create table if not exists hr.attendance_remarks (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  person_ref  uuid references hr.attendance_person(id) on delete cascade,
  remark_date date not null,
  remark      text not null,
  created_by  text,
  created_at  timestamptz default now(),
  constraint remarks_subject_chk check ((employee_id is not null) <> (person_ref is not null))
);
create index if not exists remarks_date_idx on hr.attendance_remarks (remark_date desc);

-- ── 9. RLS, matching the model already applied to the other hr tables ───────
alter table hr.sites               enable row level security;
alter table hr.attendance_person   enable row level security;
alter table hr.holidays            enable row level security;
alter table hr.attendance_settings enable row level security;
alter table hr.attendance_remarks  enable row level security;

-- everyone signed in may READ the pick-lists (the punch screen needs them)
drop policy if exists sites_read on hr.sites;
create policy sites_read on hr.sites for select to authenticated using (true);
drop policy if exists sites_write on hr.sites;
create policy sites_write on hr.sites for all to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());

drop policy if exists holidays_read on hr.holidays;
create policy holidays_read on hr.holidays for select to authenticated using (true);
drop policy if exists holidays_write on hr.holidays;
create policy holidays_write on hr.holidays for all to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());

drop policy if exists settings_read on hr.attendance_settings;
create policy settings_read on hr.attendance_settings for select to authenticated using (true);
drop policy if exists settings_write on hr.attendance_settings;
create policy settings_write on hr.attendance_settings for all to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());

-- roster + remarks are HR/admin only
drop policy if exists person_admin on hr.attendance_person;
create policy person_admin on hr.attendance_person for all to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());

drop policy if exists remarks_admin on hr.attendance_remarks;
create policy remarks_admin on hr.attendance_remarks for all to authenticated
  using (hr.is_hr_admin()) with check (hr.is_hr_admin());;