-- ============================================================================
-- hr_office_team_august_unrecorded_as_ul
--
-- Closes out August 2026 for the office team: every working day with no record
-- in EITHER source becomes UL (Uninformed Leave).
--
-- After the HSIPL sheet was imported in full (both the 31 Jul – 11 Aug gap and
-- the 12–25 Aug overlap), four of the fifteen still had days with nothing
-- anywhere — not a punch on the portal, not a row on the sheet, not a leave
-- request. 25 days in total. The EA's decision on 2026-08-25 is that those are
-- UL, so the month closes with no unexplained 'Absent'.
--
-- WHY UL AND NOT CL
-- UL is the sheet's own convention for exactly this: its Overtime Sheet tab
-- already marks unfiled days as UL. It is unpaid, so `paid_days` stays 0 and
-- the day does NOT consume the 2-day monthly paid allowance
-- (hr.employee_profile.allowed_leaves_per_month, corrected from 2.5 in
-- 20260825160000, and read by leaveService.fetchPaidLeaveUsed). Booking these
-- as CL instead would have put all four over their entitlement — Bipin nine
-- days against an allowance of two — and left payroll to unpick it.
--
-- WHAT IS DELIBERATELY NOT FILLED
--   • Sundays and holidays — not working days.
--   • Days before a person's first record. This is what keeps Prashant Kumar's
--     1–11 August out of it: he was onboarded on the 11th and first punched on
--     the 12th, so he was not an employee for those days and must not be shown
--     on leave for them. The window per person starts at their earliest
--     hr.attendance_day row, never at the 1st.
--   • Anyone who already has a leave request covering the day.
--
-- Idempotent: the NOT EXISTS on overlapping leave means a second run inserts
-- nothing.
--
-- ⚠ ONE KNOWN INTERACTION. 2026-08-19 is currently in hr.holidays as Raksha
-- Bandhan, which is the WRONG DATE (that was 2024's). It is skipped here as a
-- holiday. If the holiday calendar is corrected, 19 Aug becomes a working day
-- and anyone who did not record it would then need marking — re-running this
-- migration after the fix will do exactly that.
-- ============================================================================

with team as (
  select subject_id, employee_id, full_name, works_sunday
    from hr.attendance_subject
   where office_team and employee_id is not null
),
-- Each person's window starts at their FIRST day on record, never at the 1st.
starts as (
  select t.subject_id, t.employee_id, t.works_sunday,
         greatest('2026-08-01'::date, min(d.work_date)) as from_date
    from team t
    join hr.attendance_day d on d.subject_id = t.subject_id
   group by 1, 2, 3
),
spine as (
  select s.*, g::date as wd
    from starts s
    cross join lateral generate_series(
      s.from_date, least(current_date, '2026-08-31'::date), interval '1 day') g
),
unrecorded as (
  select sp.employee_id, sp.wd
    from spine sp
    left join hr.attendance_day d
      on d.subject_id = sp.subject_id and d.work_date = sp.wd
   where (extract(dow from sp.wd) <> 0 or sp.works_sunday)          -- not a week off
     and not exists (select 1 from hr.holidays h where h.holiday_date = sp.wd)
     and (d.work_date is null or d.day_status = 'absent')           -- nothing recorded
     and not exists (
       select 1 from hr.leave_requests l
        where l.employee_id = sp.employee_id
          and l.start_date <= sp.wd and l.end_date >= sp.wd)
)
insert into hr.leave_requests
  (employee_id, leave_type, reason, start_date, end_date,
   total_days, paid_days, unpaid_days, status, source)
select u.employee_id, 'uninformed',
       'No attendance recorded in the portal or the HSIPL sheet. Marked UL by the EA on 2026-08-25.',
       u.wd, u.wd,
       1, 0, 1,          -- unpaid: must not consume the 2-day paid allowance
       'approved', 'admin'
  from unrecorded u;
