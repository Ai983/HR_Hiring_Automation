-- ============================================================
-- 04-site-dwell.sql
-- Applied to the hub project (tpfvnerrjhqwipyonngf).
-- Time-on-site analytics for the admin Team Map: how long each employee stayed
-- at each site, derived from check_in -> check_out sessions in hr.attendance.
-- Idempotent: safe to re-run.
-- ============================================================

-- Per employee / site / IST-day dwell (minutes) from paired check_in->check_out.
-- A check_in with no following check_out (open session) contributes nothing until
-- the day is closed. Sessions longer than 18h are treated as a missing checkout
-- and skipped (avoids a forgotten punch inflating time-on-site).
create or replace function hr.site_dwell(p_from date, p_to date)
returns table (
  employee_id   uuid,
  employee_code text,
  full_name     text,
  site_ref      uuid,
  site_name     text,
  day           date,
  minutes       numeric,
  sessions      integer
)
language sql
stable
security definer
set search_path = hr, public
as $$
  with ev as (
    select a.employee_id, a.type, a.recorded_at, a.site_ref, a.site_name,
           lead(a.recorded_at) over w as next_at,
           lead(a.type)        over w as next_type
    from hr.attendance a
    where a.employee_id is not null
      and a.recorded_at >= p_from
      and a.recorded_at <  (p_to + 1)
    window w as (partition by a.employee_id order by a.recorded_at)
  ),
  sess as (
    select employee_id, site_ref, site_name,
           ((recorded_at at time zone 'Asia/Kolkata')::date) as day,
           extract(epoch from (next_at - recorded_at)) / 60.0 as minutes
    from ev
    where type = 'check_in' and next_type = 'check_out' and next_at is not null
      and (next_at - recorded_at) < interval '18 hours'
  )
  select s.employee_id, e.employee_code, e.name,
         s.site_ref, s.site_name, s.day,
         round(sum(s.minutes)::numeric, 1) as minutes,
         count(*)::int                     as sessions
  from sess s
  join public.employees e on e.id = s.employee_id
  -- RLS posture: HR/admin see everyone; anyone else sees only their own dwell.
  where hr.is_hr_admin()
     or s.employee_id = (select id from public.employees where auth_user_id = auth.uid())
  group by 1, 2, 3, 4, 5, 6
  order by s.day desc, e.name;
$$;

grant execute on function hr.site_dwell(date, date) to anon, authenticated, service_role;
