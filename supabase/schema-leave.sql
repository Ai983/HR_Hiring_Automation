-- ============================================================
-- LEAVE REQUEST SYSTEM SCHEMA
-- Run this in your Supabase SQL Editor (after schema-attendance.sql,
-- because it references public.employees).
-- ============================================================

-- LEAVE_REQUESTS table
create table if not exists public.leave_requests (
  id            uuid        default gen_random_uuid() primary key,
  employee_id   uuid        references public.employees(id) on delete cascade not null,

  -- "Leave Request To" on the form. Stored as a key now (dhruv / bhaskar);
  -- actual routing/notification to the approver is wired up later.
  request_to    text        not null,

  -- "Type of leave": casual / half_day / emergency / sick
  leave_type    text        not null
                            check (leave_type in ('casual','half_day','emergency','sick')),

  reason        text,
  start_date    date        not null,
  end_date      date        not null,

  -- Day accounting (computed on the client at submit time, frozen on the row).
  -- total_days supports 0.5 for half-day leave.
  total_days    numeric(4,1) not null default 0,
  paid_days     numeric(4,1) not null default 0,   -- covered by the 2/month allowance
  unpaid_days   numeric(4,1) not null default 0,   -- salary will be deducted for these

  status        text        not null default 'pending'
                            check (status in ('pending','approved','rejected','cancelled')),

  -- Admin review fields
  admin_notes   text,
  reviewed_by   text,
  reviewed_at   timestamptz,

  created_at    timestamptz default now()
);

-- INDEXES
create index if not exists idx_leave_employee_id on public.leave_requests(employee_id);
create index if not exists idx_leave_start_date  on public.leave_requests(start_date desc);
create index if not exists idx_leave_status      on public.leave_requests(status);

-- ROW LEVEL SECURITY (open, matching the other tables in this project)
alter table public.leave_requests enable row level security;

drop policy if exists "allow_all_leave_requests" on public.leave_requests;
create policy "allow_all_leave_requests" on public.leave_requests
  for all using (true) with check (true);
