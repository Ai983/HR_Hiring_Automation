-- ============================================================================
-- hr_late_at_minute_granularity_and_close_gap
--
-- Two finishing moves for the office-team report. Both depend on
-- 20260825120000 and on scripts/import-hsipl-gap.mjs having been run with
-- --apply; running this first would expose the very absences the blackout
-- exists to suppress.
--
-- ── 1. LATE IS DECIDED ON THE MINUTE, NOT THE SECOND ───────────────────────
-- late_after is 09:30 and the comparison was `in_at::time > late_after`, which
-- is exact to the second. Deepak Bansal punched in at 09:30:58 on 2026-07-11:
-- strictly after 09:30, so the system called it Late — while the printed sheet
-- report for the same day shows "09:30  On Time", because every human-facing
-- surface here renders HH:MM and the sheet compared what it rendered.
--
-- Nobody at Hagerstone has ever been told the rule is enforced to the second,
-- the punch screen shows the employee HH:MM, and a fifty-eight-second
-- discrepancy is not something anyone can act on. So the comparison is
-- truncated to the minute: late from 09:31, on time at 09:30:59. This is what
-- "match the sheet" actually means, and doing it in the view keeps
-- late_after readable as '09:30' in Attendance Setup instead of a cryptic
-- '09:30:59' that means the same thing by accident.
--
-- ── 2. THE COVERAGE GAP IS CLOSED ──────────────────────────────────────────
-- 20260814074535 blanked out 2026-07-31 .. 2026-08-11, the twelve days between
-- the end of the original HSIPL import and the portal going live, because
-- attendance_day's spine scored every one of them 'absent' for everybody.
-- Those days now hold 550 real punches and 33 real leave rows imported from
-- the sheet, so the window is retired.
--
-- The MECHANISM is deliberately kept — only the window is cleared. If the
-- portal ever goes dark again, setting the two dates is the whole fix.
--
-- Days inside the old window with neither a punch nor a leave now read
-- 'absent', which is correct: the sheet is a complete record for those twelve
-- days, so no punch and no leave means the person genuinely was not there.
-- ============================================================================

create or replace view hr.attendance_day as
 WITH cfg AS (
         SELECT attendance_settings.id,
            attendance_settings.shift_start,
            attendance_settings.shift_end,
            attendance_settings.late_after,
            attendance_settings.full_day_minutes,
            attendance_settings.half_day_minutes,
            attendance_settings.ot_after_minutes,
            attendance_settings.weekend_dows,
            attendance_settings.coverage_gap_from,
            attendance_settings.coverage_gap_to,
            attendance_settings.updated_at
           FROM hr.attendance_settings
          WHERE attendance_settings.id
        ), punch AS (
         SELECT COALESCE(a.employee_id, a.person_ref) AS subject_id,
            (a.recorded_at AT TIME ZONE 'Asia/Kolkata'::text)::date AS work_date,
            a.type, a.recorded_at, a.site_name, a.location_verified,
            a.selfie_url, a.photo_url, a.admin_notes, a.source
           FROM hr.attendance a
        ), daily AS (
         SELECT punch.subject_id, punch.work_date,
            min(punch.recorded_at) FILTER (WHERE punch.type = 'check_in'::text) AS in_at,
            max(punch.recorded_at) FILTER (WHERE punch.type = 'check_out'::text) AS out_at,
            count(*) AS punch_count,
            min(punch.site_name) FILTER (WHERE punch.type = 'check_in'::text) AS site_name,
            bool_or(punch.location_verified IS FALSE) AS any_unverified,
            max(COALESCE(punch.selfie_url, punch.photo_url)) AS photo,
            string_agg(DISTINCT punch.admin_notes, ' | '::text) AS admin_notes,
            min(punch.source) AS source
           FROM punch
          GROUP BY punch.subject_id, punch.work_date
        ), bounds AS (
         SELECT daily.subject_id, min(daily.work_date) AS from_date, max(daily.work_date) AS to_date
           FROM daily GROUP BY daily.subject_id
        UNION ALL
         SELECT COALESCE(leave_requests.employee_id, leave_requests.person_ref) AS "coalesce",
            min(leave_requests.start_date) AS min, max(leave_requests.end_date) AS max
           FROM hr.leave_requests
          WHERE leave_requests.status = ANY (ARRAY['approved'::text, 'pending'::text])
          GROUP BY (COALESCE(leave_requests.employee_id, leave_requests.person_ref))
        ), win AS (
         SELECT bounds.subject_id, min(bounds.from_date) AS from_date, max(bounds.to_date) AS to_date
           FROM bounds WHERE bounds.subject_id IS NOT NULL GROUP BY bounds.subject_id
        ), spine AS (
         SELECT w.subject_id, d_1.d::date AS work_date
           FROM win w
             CROSS JOIN LATERAL generate_series(w.from_date::timestamp with time zone, w.to_date::timestamp with time zone, '1 day'::interval) d_1(d)
        )
 SELECT s.subject_id, sub.subject_kind, sub.full_name, sub.employee_code, sub.department,
    s.work_date, d.in_at, d.out_at, d.punch_count, d.site_name, d.photo, d.admin_notes,
    COALESCE(d.source, 'none'::text) AS source,
    d.any_unverified,
        CASE
            WHEN d.in_at IS NOT NULL AND d.out_at IS NOT NULL AND d.out_at > d.in_at THEN (EXTRACT(epoch FROM d.out_at - d.in_at) / 60::numeric)::integer
            ELSE NULL::integer
        END AS worked_minutes,
        CASE
            WHEN d.in_at IS NOT NULL AND d.out_at IS NOT NULL AND d.out_at > d.in_at THEN GREATEST(0, (EXTRACT(epoch FROM d.out_at - d.in_at) / 60::numeric)::integer - c.ot_after_minutes)
            ELSE NULL::integer
        END AS ot_minutes,
    h.holiday_date IS NOT NULL AS is_holiday,
    h.name AS holiday_name,
    (EXTRACT(dow FROM s.work_date)::integer = ANY (c.weekend_dows)) AND NOT sub.works_sunday AS is_week_off,
    lv.leave_type, lv.leave_status,
        CASE
            WHEN h.holiday_date IS NOT NULL THEN 'holiday'::text
            WHEN (EXTRACT(dow FROM s.work_date)::integer = ANY (c.weekend_dows)) AND NOT sub.works_sunday THEN 'week_off'::text
            WHEN d.in_at IS NOT NULL AND (lv.leave_type = ANY (ARRAY['half_day'::text, 'short_leave'::text])) THEN lv.leave_type
            WHEN d.in_at IS NULL AND lv.leave_type IS NOT NULL THEN lv.leave_type
            WHEN d.in_at IS NULL THEN 'absent'::text
            -- Truncated to the minute: 09:30:58 is on time, 09:31:00 is late.
            -- See the header — the second-exact comparison disagreed with every
            -- report Hagerstone has ever printed.
            WHEN date_trunc('minute', d.in_at AT TIME ZONE 'Asia/Kolkata'::text)::time without time zone > c.late_after THEN 'late'::text
            ELSE 'present'::text
        END AS day_status,
        CASE
            WHEN h.holiday_date IS NOT NULL THEN 0::numeric
            WHEN (EXTRACT(dow FROM s.work_date)::integer = ANY (c.weekend_dows)) AND NOT sub.works_sunday THEN 0::numeric
            WHEN lv.leave_type = 'half_day'::text THEN 0.5
            WHEN lv.leave_type = 'short_leave'::text THEN 0.75
            WHEN d.in_at IS NOT NULL THEN 1::numeric
            ELSE 0::numeric
        END AS day_credit
   FROM spine s
     JOIN hr.attendance_subject sub ON sub.subject_id = s.subject_id
     CROSS JOIN cfg c
     LEFT JOIN daily d ON d.subject_id = s.subject_id AND d.work_date = s.work_date
     LEFT JOIN hr.holidays h ON h.holiday_date = s.work_date
     LEFT JOIN LATERAL ( SELECT lr.leave_type, lr.status AS leave_status
           FROM hr.leave_requests lr
          WHERE (lr.employee_id = sub.employee_id OR lr.person_ref = sub.person_ref)
            AND (lr.status = ANY (ARRAY['approved'::text, 'pending'::text]))
            AND s.work_date >= lr.start_date AND s.work_date <= lr.end_date
          ORDER BY (CASE lr.status WHEN 'approved'::text THEN 0 ELSE 1 END)
         LIMIT 1) lv ON true
  WHERE (s.work_date <= CURRENT_DATE OR lv.leave_type IS NOT NULL)
    AND NOT (
          d.in_at IS NULL
      AND lv.leave_type IS NULL
      AND c.coverage_gap_from IS NOT NULL
      AND s.work_date >= c.coverage_gap_from
      AND s.work_date <= c.coverage_gap_to
    );

alter view hr.attendance_day set (security_invoker = true);
grant select on hr.attendance_day to authenticated;

-- The window is covered by real rows now. The mechanism stays for next time.
update hr.attendance_settings
   set coverage_gap_from = null, coverage_gap_to = null, updated_at = now()
 where id;
