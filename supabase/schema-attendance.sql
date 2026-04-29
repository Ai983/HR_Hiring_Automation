-- ============================================================
-- ATTENDANCE SYSTEM SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- EMPLOYEES table
create table if not exists public.employees (
  id              uuid        default gen_random_uuid() primary key,
  employee_code   text        unique not null,          -- e.g. "EMP001"
  full_name       text        not null,
  email           text,
  phone           text,
  department      text,
  designation     text,
  pin             text        not null,                 -- 4-6 digit PIN
  is_active       boolean     default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ATTENDANCE table
create table if not exists public.attendance (
  id            uuid        default gen_random_uuid() primary key,
  employee_id   uuid        references public.employees(id) on delete cascade not null,
  type          text        not null check (type in ('check_in', 'check_out')),
  recorded_at   timestamptz not null,
  latitude      numeric(10, 7),
  longitude     numeric(10, 7),
  address       text,
  selfie_url    text,
  status        text        default 'present'
                            check (status in ('present', 'late', 'absent', 'half_day', 'on_leave')),
  admin_notes   text,
  created_at    timestamptz default now()
);

-- INDEXES
create index if not exists idx_attendance_employee_id  on public.attendance(employee_id);
create index if not exists idx_attendance_recorded_at  on public.attendance(recorded_at desc);
create index if not exists idx_employees_employee_code on public.employees(employee_code);
create index if not exists idx_employees_is_active     on public.employees(is_active);

-- ROW LEVEL SECURITY (open, matching other tables in this project)
alter table public.employees  enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "allow_all_employees"  on public.employees;
drop policy if exists "allow_all_attendance" on public.attendance;

create policy "allow_all_employees"  on public.employees  for all using (true) with check (true);
create policy "allow_all_attendance" on public.attendance for all using (true) with check (true);

-- ============================================================
-- STORAGE BUCKET FOR SELFIES
-- Run these separately in the Supabase Dashboard → Storage
-- OR paste into SQL Editor:
-- ============================================================
-- insert into storage.buckets (id, name, public)
--   values ('selfies', 'selfies', true)
--   on conflict (id) do nothing;
--
-- drop policy if exists "allow_all_selfies" on storage.objects;
-- create policy "allow_all_selfies" on storage.objects
--   for all using (bucket_id = 'selfies') with check (bucket_id = 'selfies');
