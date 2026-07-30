-- ============================================================================
-- Rebuild of hr.attendance_day over a DATE SPINE.
--
-- The first version only emitted rows for days that had punches, so absences,
-- week-offs, holidays and leave days simply vanished (Shivani showed 0 week-offs
-- for a July with 4 Sundays). The sheet's Overtime Sheet lists EVERY date, so
-- the spine is required for parity.
--
-- Spine = each subject's first-seen day .. least(their last activity, today),
-- which keeps it bounded instead of exploding across all subjects x all dates.
--
-- day_credit is now driven by the LEAVE CODE, not by hours worked. The sheet
-- treats attendance as binary and takes fractions from HD/SHL, and the earlier
-- hours-based rule wrongly scored an 8h42m day as a half day.
-- ============================================================================

create or replace view hr.attendance_day as
with cfg as (select * from hr.attendance_settings where id),
punch as (
  select coalesce(a.employee_id, a.person_ref)            as subject_id,
         (a.recorded_at at time zone 'Asia/Kolkata')::date as work_date,
         a.type, a.recorded_at, a.site_name,
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
  from punch group by subject_id, work_date
),
-- every subject's active window, from punches AND leave
bounds as (
  select subject_id, min(work_date) as from_date, max(work_date) as to_date
  from daily group by subject_id
  union all
  select coalesce(employee_id, person_ref), min(start_date), max(end_date)
  from hr.leave_requests where status in ('approved','pending')
  group by coalesce(employee_id, person_ref)
),
window_per_subject as (
  select subject_id, min(from_date) as from_date,
         least(max(to_date), current_date) as to_date
  from bounds where subject_id is not null group by subject_id
),
spine as (
  select w.subject_id, d::date as work_date
  from window_per_subject w
  cross join generate_series(w.from_date, w.to_date, interval '1 day') d
)
select s.subject_id,
       sub.subject_kind,
       sub.full_name,
       sub.employee_code,
       sub.department,
       s.work_date,
       d.in_at, d.out_at, d.punch_count, d.site_name, d.photo, d.admin_notes,
       coalesce(d.source, 'none') as source,
       d.any_unverified,
       case when d.in_at is not null and d.out_at is not null and d.out_at > d.in_at
            then (extract(epoch from (d.out_at - d.in_at)) / 60)::int end as worked_minutes,
       case when d.in_at is not null and d.out_at is not null and d.out_at > d.in_at
            then greatest(0, (extract(epoch from (d.out_at - d.in_at)) / 60)::int - c.ot_after_minutes) end as ot_minutes,
       (h.holiday_date is not null)                                        as is_holiday,
       h.name                                                              as holiday_name,
       (extract(dow from s.work_date)::int = any(c.weekend_dows) and not sub.works_sunday) as is_week_off,
       lv.leave_type,
       lv.leave_status,
       case
         when h.holiday_date is not null then 'holiday'
         when extract(dow from s.work_date)::int = any(c.weekend_dows) and not sub.works_sunday then 'week_off'
         -- a half/short leave still involves attending, so a punch wins there
         when d.in_at is not null and lv.leave_type in ('half_day','short_leave') then lv.leave_type
         when d.in_at is null and lv.leave_type is not null then lv.leave_type
         when d.in_at is null then 'absent'
         when (d.in_at at time zone 'Asia/Kolkata')::time > c.late_after then 'late'
         else 'present'
       end                                                                 as day_status,
       case
         when h.holiday_date is not null then 0
         when extract(dow from s.work_date)::int = any(c.weekend_dows) and not sub.works_sunday then 0
         when lv.leave_type = 'half_day'    then 0.5
         when lv.leave_type = 'short_leave' then 0.75
         when d.in_at is not null then 1
         when lv.leave_type is not null then 0
         else 0
       end::numeric                                                        as day_credit
from spine s
join hr.attendance_subject sub on sub.subject_id = s.subject_id
cross join cfg c
left join daily d on d.subject_id = s.subject_id and d.work_date = s.work_date
left join hr.holidays h on h.holiday_date = s.work_date
left join lateral (
  select lr.leave_type, lr.status as leave_status
  from hr.leave_requests lr
  where (lr.employee_id = sub.employee_id or lr.person_ref = sub.person_ref)
    and lr.status in ('approved','pending')
    and s.work_date between lr.start_date and lr.end_date
  order by case lr.status when 'approved' then 0 else 1 end
  limit 1
) lv on true;

grant select on hr.attendance_day to authenticated;;