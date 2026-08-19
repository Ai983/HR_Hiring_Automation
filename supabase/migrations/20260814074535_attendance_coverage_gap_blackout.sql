-- ============================================================
-- attendance_coverage_gap_blackout
--
-- Applied to production 2026-08-14. Captured back into the repo on 2026-08-19,
-- where it had been missing — hr.attendance_day in production was ahead of
-- every attendance_day definition in this folder. If you rebuild the module
-- from these files, this one must run AFTER
-- 20260730061955_hr_attendance_day_include_future_approved_leave.sql, which it
-- supersedes.
--
-- The HSIPL import ends 2026-07-30; the portal went live 2026-08-12.
-- For the days in between, the system has no record of ANYONE — but
-- attendance_day's spine still generated a working day per person and
-- day_status fell through to 'absent'. Five employees carried up to 10
-- fabricated absences each, and colleagues differed only by whether the
-- spine happened to cover them, so the reports were inconsistent too.
--
-- Fix: a stored coverage-gap window. Days inside it with no punch AND no
-- leave are not emitted at all, so neither attendance_day nor
-- attendance_month (which counts from it) can score them.
-- A real punch or an approved leave inside the window still shows.
-- Idempotent.
-- ============================================================

alter table hr.attendance_settings
  add column if not exists coverage_gap_from date,
  add column if not exists coverage_gap_to   date;

comment on column hr.attendance_settings.coverage_gap_from is
  'Start of a period with no attendance coverage. Days in [from,to] with no punch and no leave are excluded from attendance_day, so they are never counted absent.';

update hr.attendance_settings
   set coverage_gap_from = '2026-07-31',
       coverage_gap_to   = '2026-08-11',
       updated_at = now()
 where id and coverage_gap_from is null;

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
            WHEN (d.in_at AT TIME ZONE 'Asia/Kolkata'::text)::time without time zone > c.late_after THEN 'late'::text
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
    -- Coverage gap: no punch, no leave, inside the window → the day never happened
    -- as far as this system knows. Emitting it would score it 'absent'.
    AND NOT (
          d.in_at IS NULL
      AND lv.leave_type IS NULL
      AND c.coverage_gap_from IS NOT NULL
      AND s.work_date >= c.coverage_gap_from
      AND s.work_date <= c.coverage_gap_to
    );

alter view hr.attendance_day set (security_invoker = true);
