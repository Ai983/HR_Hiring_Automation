-- ============================================================================
-- hr_reapply_late_minute_and_out_only_over_regularization
--
-- RESTORES TWO FIXES THAT WERE SILENTLY LOST.
--
-- On 2026-08-25 two corrections went into hr.attendance_day:
--   20260825130000 — `late` is decided at MINUTE granularity, so 09:30:58 is on
--                    time and 09:41:00 is late (matching every report ever
--                    printed off the HSIPL sheet, which compared the HH:MM it
--                    rendered)
--   20260825150000 — a day with a check-OUT and no check-in counts as attended,
--                    not absent (427 days across 76 people)
--
-- Between then and 2026-08-28 the attendance-regularization feature was added,
-- and hr.attendance_day was rebuilt to honour hr.attendance_regularization —
-- but rebuilt from a definition that PRE-DATED both fixes, so both were
-- reverted. Nothing warned anybody: the view still worked, it just quietly
-- went back to scoring seconds and calling a lone check-out an absence.
--
-- This re-applies them ON TOP of the regularization-aware definition rather
-- than overwriting it. Regularization support is kept in full.
--
-- ⚠ IF YOU REBUILD hr.attendance_day AGAIN, START FROM THIS FILE.
-- It is the only definition that carries all four behaviours at once:
-- regularization overrides, the coverage-gap clause, minute-granularity late,
-- and out-only-is-attended. Copying an older `create or replace view` from an
-- earlier migration silently drops whichever ones it predates.
--
-- Two further consistency corrections while merging, both low risk — all 17
-- existing regularization rows carry an explicit new_status, which the outer
-- COALESCE takes first, so none of them change:
--   • day_status now reads COALESCE(reg.in_at, d.in_at), matching the in_at
--     column the view actually exposes. Previously a regularization that set
--     times but no status would have been ignored when scoring the day.
--   • the coverage-gap exclusion now also requires out_at to be null, so a day
--     holding only a check-out is never suppressed as "no coverage".
-- ============================================================================

create or replace view hr.attendance_day as
 WITH cfg AS (
         SELECT attendance_settings.id, attendance_settings.shift_start, attendance_settings.shift_end,
            attendance_settings.late_after, attendance_settings.full_day_minutes,
            attendance_settings.half_day_minutes, attendance_settings.ot_after_minutes,
            attendance_settings.weekend_dows, attendance_settings.coverage_gap_from,
            attendance_settings.coverage_gap_to, attendance_settings.updated_at
           FROM hr.attendance_settings WHERE attendance_settings.id
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
           FROM punch GROUP BY punch.subject_id, punch.work_date
        ), bounds AS (
         SELECT daily.subject_id, min(daily.work_date) AS from_date, max(daily.work_date) AS to_date
           FROM daily GROUP BY daily.subject_id
        UNION ALL
         SELECT COALESCE(leave_requests.employee_id, leave_requests.person_ref) AS "coalesce",
            min(leave_requests.start_date) AS min, max(leave_requests.end_date) AS max
           FROM hr.leave_requests
          WHERE leave_requests.status = ANY (ARRAY['approved'::text, 'pending'::text])
          GROUP BY (COALESCE(leave_requests.employee_id, leave_requests.person_ref))
        UNION ALL
         SELECT attendance_regularization.subject_id,
            min(attendance_regularization.work_date) AS min,
            max(attendance_regularization.work_date) AS max
           FROM hr.attendance_regularization
          GROUP BY attendance_regularization.subject_id
        ), win AS (
         SELECT bounds.subject_id, min(bounds.from_date) AS from_date, max(bounds.to_date) AS to_date
           FROM bounds WHERE bounds.subject_id IS NOT NULL GROUP BY bounds.subject_id
        ), spine AS (
         SELECT w.subject_id, d_1.d::date AS work_date
           FROM win w CROSS JOIN LATERAL generate_series(w.from_date::timestamp with time zone, w.to_date::timestamp with time zone, '1 day'::interval) d_1(d)
        )
 SELECT s.subject_id, sub.subject_kind, sub.full_name, sub.employee_code, sub.department,
    s.work_date,
    COALESCE(reg.in_at, d.in_at) AS in_at,
    COALESCE(reg.out_at, d.out_at) AS out_at,
    d.punch_count, d.site_name, d.photo, d.admin_notes,
        CASE
            WHEN reg.new_status IS NOT NULL THEN 'regularized'::text
            ELSE COALESCE(d.source, 'none'::text)
        END AS source,
    d.any_unverified,
    COALESCE(
        CASE
            WHEN COALESCE(reg.in_at, d.in_at) IS NOT NULL AND COALESCE(reg.out_at, d.out_at) IS NOT NULL AND COALESCE(reg.out_at, d.out_at) > COALESCE(reg.in_at, d.in_at) THEN (EXTRACT(epoch FROM COALESCE(reg.out_at, d.out_at) - COALESCE(reg.in_at, d.in_at)) / 60::numeric)::integer
            ELSE NULL::integer
        END, reg.worked_minutes) AS worked_minutes,
        CASE
            WHEN COALESCE(reg.in_at, d.in_at) IS NOT NULL AND COALESCE(reg.out_at, d.out_at) IS NOT NULL AND COALESCE(reg.out_at, d.out_at) > COALESCE(reg.in_at, d.in_at) THEN GREATEST(0, (EXTRACT(epoch FROM COALESCE(reg.out_at, d.out_at) - COALESCE(reg.in_at, d.in_at)) / 60::numeric)::integer - c.ot_after_minutes)
            ELSE NULL::integer
        END AS ot_minutes,
    h.holiday_date IS NOT NULL AS is_holiday, h.name AS holiday_name,
    (EXTRACT(dow FROM s.work_date)::integer = ANY (c.weekend_dows)) AND NOT sub.works_sunday AS is_week_off,
    lv.leave_type, lv.leave_status,
    COALESCE(reg.new_status,
        CASE
            WHEN h.holiday_date IS NOT NULL THEN 'holiday'::text
            WHEN (EXTRACT(dow FROM s.work_date)::integer = ANY (c.weekend_dows)) AND NOT sub.works_sunday THEN 'week_off'::text
            WHEN COALESCE(reg.in_at, d.in_at) IS NOT NULL AND (lv.leave_type = ANY (ARRAY['half_day'::text, 'short_leave'::text])) THEN lv.leave_type
            WHEN COALESCE(reg.in_at, d.in_at) IS NULL AND lv.leave_type IS NOT NULL THEN lv.leave_type
            -- Punched out but never in: they were here. Never 'late' — there is
            -- no in-time to compare, and guessing would punish a missed punch.
            WHEN COALESCE(reg.in_at, d.in_at) IS NULL AND COALESCE(reg.out_at, d.out_at) IS NOT NULL THEN 'present'::text
            WHEN COALESCE(reg.in_at, d.in_at) IS NULL THEN 'absent'::text
            -- Minute granularity: 09:40:59 is on time, 09:41:00 is late.
            WHEN date_trunc('minute', COALESCE(reg.in_at, d.in_at) AT TIME ZONE 'Asia/Kolkata'::text)::time without time zone > c.late_after THEN 'late'::text
            ELSE 'present'::text
        END) AS day_status,
        CASE
            WHEN reg.new_status IS NOT NULL THEN
            CASE reg.new_status
                WHEN 'half_day'::text THEN 0.5
                WHEN 'short_leave'::text THEN 0.75
                WHEN 'present'::text THEN 1::numeric
                WHEN 'late'::text THEN 1::numeric
                ELSE 0::numeric
            END
            WHEN h.holiday_date IS NOT NULL THEN 0::numeric
            WHEN (EXTRACT(dow FROM s.work_date)::integer = ANY (c.weekend_dows)) AND NOT sub.works_sunday THEN 0::numeric
            WHEN lv.leave_type = 'half_day'::text THEN 0.5
            WHEN lv.leave_type = 'short_leave'::text THEN 0.75
            WHEN COALESCE(reg.in_at, d.in_at) IS NOT NULL OR COALESCE(reg.out_at, d.out_at) IS NOT NULL THEN 1::numeric
            ELSE 0::numeric
        END AS day_credit
   FROM spine s
     JOIN hr.attendance_subject sub ON sub.subject_id = s.subject_id
     CROSS JOIN cfg c
     LEFT JOIN daily d ON d.subject_id = s.subject_id AND d.work_date = s.work_date
     LEFT JOIN hr.holidays h ON h.holiday_date = s.work_date
     LEFT JOIN hr.attendance_regularization reg ON reg.subject_id = s.subject_id AND reg.work_date = s.work_date
     LEFT JOIN LATERAL ( SELECT lr.leave_type, lr.status AS leave_status
           FROM hr.leave_requests lr
          WHERE (lr.employee_id = sub.employee_id OR lr.person_ref = sub.person_ref)
            AND (lr.status = ANY (ARRAY['approved'::text, 'pending'::text]))
            AND s.work_date >= lr.start_date AND s.work_date <= lr.end_date
          ORDER BY (CASE lr.status WHEN 'approved'::text THEN 0 ELSE 1 END) LIMIT 1) lv ON true
  WHERE (s.work_date <= CURRENT_DATE OR lv.leave_type IS NOT NULL OR reg.new_status IS NOT NULL)
    AND NOT (d.in_at IS NULL AND d.out_at IS NULL AND lv.leave_type IS NULL AND reg.new_status IS NULL
             AND c.coverage_gap_from IS NOT NULL
             AND s.work_date >= c.coverage_gap_from AND s.work_date <= c.coverage_gap_to);

alter view hr.attendance_day set (security_invoker = true);
grant select on hr.attendance_day to authenticated;
