-- ============================================================
-- 06-attendance-overview.sql
-- Applied to the hub project (tpfvnerrjhqwipyonngf).
-- One admin-gated overview RPC for the Hagerstone-Hub founder dashboard.
-- Lives in PUBLIC (the Hub's supabase client uses the default schema) but reads
-- the hr.* attendance data. Returns null to non-admins.
-- Idempotent: safe to re-run.
-- ============================================================

create or replace function public.hr_attendance_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, hr
as $$
declare
  ist_today date        := ((now() at time zone 'Asia/Kolkata')::date);
  day_start timestamptz  := (ist_today::timestamp at time zone 'Asia/Kolkata');
  day_end   timestamptz  := ((ist_today + 1)::timestamp at time zone 'Asia/Kolkata');
  active_n  int;
  result    jsonb;
begin
  -- Founders/HR/admins only; everyone else gets nothing.
  if not hr.is_hr_admin() then
    return null;
  end if;

  select count(*) into active_n from public.employees where is_active;

  with today_punch as (   -- last punch today per employee (are they in or out now?)
    select distinct on (a.employee_id) a.employee_id, a.type
    from hr.attendance a
    where a.recorded_at >= day_start and a.recorded_at < day_end and a.employee_id is not null
    order by a.employee_id, a.recorded_at desc
  ),
  first_in as (           -- first check-in today per employee (on-time vs late)
    select distinct on (a.employee_id) a.employee_id, a.status
    from hr.attendance a
    where a.type = 'check_in' and a.recorded_at >= day_start and a.recorded_at < day_end
      and a.employee_id is not null
    order by a.employee_id, a.recorded_at asc
  ),
  leave_today as (
    select distinct employee_id from hr.leave_requests
    where status = 'approved' and start_date <= ist_today and end_date >= ist_today
  ),
  latest_loc as (         -- last known position per employee in the last 24h
    select distinct on (l.employee_id) l.employee_id, l.latitude, l.longitude, l.site_name, l.captured_at
    from hr.location_tracking l
    where l.captured_at >= now() - interval '24 hours' and l.latitude is not null
    order by l.employee_id, l.captured_at desc
  )
  select jsonb_build_object(
    'as_of',    now(),
    'ist_date', ist_today,
    'today', jsonb_build_object(
      'total_active', active_n,
      'checked_in',   (select count(*) from today_punch),
      'present',      (select count(*) from first_in where status = 'present'),
      'late',         (select count(*) from first_in where status = 'late'),
      'on_site_now',  (select count(*) from today_punch where type = 'check_in'),
      'on_leave',     (select count(*) from leave_today),
      'absent',       greatest(0, active_n
                        - (select count(*) from today_punch)
                        - (select count(*) from leave_today))
    ),
    'out_of_site', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', e.name, 'code', e.employee_code, 'site', a.site_name,
        'distance_m', a.site_distance_m, 'at', a.recorded_at, 'type', a.type
      ) order by a.recorded_at desc)
      from hr.attendance a join public.employees e on e.id = a.employee_id
      where a.site_match = 'mismatch' and a.recorded_at >= day_start and a.recorded_at < day_end
    ), '[]'::jsonb),
    'team', coalesce((
      select jsonb_agg(jsonb_build_object(
        'employee_id', ll.employee_id, 'name', e.name, 'code', e.employee_code,
        'latitude', ll.latitude, 'longitude', ll.longitude, 'site_name', ll.site_name,
        'captured_at', ll.captured_at,
        'live', (ll.captured_at >= now() - interval '30 minutes')
      ))
      from latest_loc ll join public.employees e on e.id = ll.employee_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.hr_attendance_overview() to authenticated, service_role;
