-- ============================================================================
-- Replaces the sheet's BACKHAND / Monthly Attendance / Overtime Sheet tabs.
-- Views, so the numbers can never drift from the punches. hr schema only.
-- ============================================================================

-- Unified "who" — a hub employee OR an HR-roster person — so one set of views
-- covers both without touching public.employees.
create or replace view hr.attendance_subject as
  select e.id                                as subject_id,
         'employee'::text                    as subject_kind,
         e.id                                as employee_id,
         null::uuid                          as person_ref,
         e.full_name,
         e.employee_code,
         e.department,
         coalesce(p.planned_days_per_week, 6)     as planned_days_per_week,
         coalesce(p.works_sunday, false)          as works_sunday,
         coalesce(p.allowed_leaves_per_month, 2.5) as allowed_leaves_per_month,
         e.is_active
  from hr.employees e
  left join hr.employee_profile p on p.employee_id = e.id
  union all
  select ap.id, 'roster', null::uuid, ap.id, ap.full_name, null, null,
         ap.planned_days_per_week, ap.works_sunday, 0::numeric, ap.active
  from hr.attendance_person ap
  where ap.employee_id is null;   -- once linked, the employee row represents them

-- ── Per-person, per-day roll-up ─────────────────────────────────────────────
create or replace view hr.attendance_day as
with cfg as (select * from hr.attendance_settings where id),
punches as (
  select coalesce(a.employee_id, a.person_ref)              as subject_id,
         (a.recorded_at at time zone 'Asia/Kolkata')::date   as work_date,
         a.type, a.recorded_at, a.status, a.site_name, a.site_ref,
         a.location_verified, a.selfie_url, a.photo_url, a.admin_notes, a.source
  from hr.attendance a
),
daily as (
  select subject_id, work_date,
         min(recorded_at) filter (where type = 'check_in')  as in_at,
         max(recorded_at) filter (where type = 'check_out') as out_at,
         count(*)                                           as punch_count,
         min(site_name) filter (where type = 'check_in')     as site_name,
         bool_or(location_verified is false)                 as any_unverified,
         max(coalesce(selfie_url, photo_url))                as photo,
         string_agg(distinct admin_notes, ' | ')             as admin_notes,
         min(source)                                         as source
  from punches group by subject_id, work_date
)
select s.subject_id,
       s.subject_kind,
       s.full_name,
       s.employee_code,
       s.department,
       d.work_date,
       d.in_at,
       d.out_at,
       d.punch_count,
       d.site_name,
       d.photo,
       d.admin_notes,
       d.source,
       d.any_unverified,
       -- worked / overtime
       case when d.in_at is not null and d.out_at is not null and d.out_at > d.in_at
            then (extract(epoch from (d.out_at - d.in_at)) / 60)::int end          as worked_minutes,
       case when d.in_at is not null and d.out_at is not null and d.out_at > d.in_at
            then greatest(0, (extract(epoch from (d.out_at - d.in_at)) / 60)::int - c.ot_after_minutes) end as ot_minutes,
       -- calendar context
       (h.holiday_date is not null)                                               as is_holiday,
       h.name                                                                     as holiday_name,
       (extract(dow from d.work_date)::int = any(c.weekend_dows) and not s.works_sunday) as is_week_off,
       lv.leave_type,
       lv.leave_status,
       -- final status, in the sheet's own precedence order
       case
         when h.holiday_date is not null then 'holiday'
         when extract(dow from d.work_date)::int = any(c.weekend_dows) and not s.works_sunday then 'week_off'
         when lv.leave_type is not null and d.in_at is null then lv.leave_type
         when d.in_at is null then 'absent'
         when (d.in_at at time zone 'Asia/Kolkata')::time > c.late_after then 'late'
         else 'present'
       end                                                                        as day_status,
       -- how much of a working day this counts as
       case
         when h.holiday_date is not null then 0
         when extract(dow from d.work_date)::int = any(c.weekend_dows) and not s.works_sunday then 0
         when d.in_at is null then 0
         when d.out_at is null then 0.5
         when (extract(epoch from (d.out_at - d.in_at)) / 60) >= c.full_day_minutes then 1
         when (extract(epoch from (d.out_at - d.in_at)) / 60) >= c.half_day_minutes then 0.5
         else 0.5
       end::numeric                                                               as day_credit
from daily d
join hr.attendance_subject s on s.subject_id = d.subject_id
cross join cfg c
left join hr.holidays h on h.holiday_date = d.work_date
left join lateral (
  select lr.leave_type, lr.status as leave_status
  from hr.leave_requests lr
  where lr.employee_id = s.employee_id
    and lr.status in ('approved','pending')
    and d.work_date between lr.start_date and lr.end_date
  order by case lr.status when 'approved' then 0 else 1 end
  limit 1
) lv on true;

-- ── Per-person, per-month summary (the Overtime Sheet header block) ─────────
create or replace view hr.attendance_month as
select subject_id, subject_kind, full_name, employee_code, department,
       date_trunc('month', work_date)::date              as month,
       count(*) filter (where day_status in ('present','late'))            as days_worked,
       sum(day_credit)                                                     as working_days,
       count(*) filter (where day_status = 'present')                      as on_time,
       count(*) filter (where day_status = 'late')                         as late,
       count(*) filter (where day_status = 'absent')                       as absent,
       count(*) filter (where day_status = 'week_off')                     as week_offs,
       count(*) filter (where day_status = 'holiday')                      as holidays,
       count(*) filter (where day_status = 'casual')                       as cl,
       count(*) filter (where day_status = 'emergency')                    as el,
       count(*) filter (where day_status = 'sick')                         as sl,
       count(*) filter (where day_status = 'half_day')                     as hd,
       count(*) filter (where day_status = 'short_leave')                  as shl,
       count(*) filter (where day_status = 'uninformed')                   as ul,
       coalesce(sum(worked_minutes), 0)                                    as worked_minutes,
       coalesce(sum(ot_minutes), 0)                                        as ot_minutes,
       count(*) filter (where out_at is null and in_at is not null)        as missing_checkout
from hr.attendance_day
group by subject_id, subject_kind, full_name, employee_code, department, date_trunc('month', work_date);

grant select on hr.attendance_subject, hr.attendance_day, hr.attendance_month to authenticated;;