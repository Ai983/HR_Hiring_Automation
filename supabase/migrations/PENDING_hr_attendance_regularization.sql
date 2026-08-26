-- ============================================================================
-- hr_attendance_regularization  (PENDING — not yet applied to production)
--
-- Gives HR a governed way to CORRECT a past attendance day, since
-- hr.attendance_day is a computed view (punches + leave + holidays + week-off +
-- coverage gap) and cannot be edited directly.
--
-- Design:
--   * hr.attendance_regularization  — one override row per (subject, day). The
--     view honours it with top precedence, so a corrected day shows the EA's
--     status / times instead of the computed one. Real punches in hr.attendance
--     are never faked or mutated — corrections live in their own labelled table.
--   * hr.is_attendance_regularizer() — HR-only gate (hr.admin), mirrors hr.is_leave_approver().
--   * Every write is attributable: regularized_by (auth uid) + email + timestamp
--     + a MANDATORY reason. No silent edits.
--   * SEGREGATION OF DUTIES: a regularizer may NOT regularize their OWN record
--     (subject_id <> hr.my_employee_id()). If the HR admin's own attendance needs a
--     correction, a second approver must do it — add their email to
--     hr.is_attendance_regularizer() below. This guard is intentional; do not
--     remove it to let one person edit their own pay record.
--
-- Apply order: AFTER
--   20260814074535_attendance_coverage_gap_blackout.sql   (current attendance_day)
--   20260818093922_hr_leave_approval_ea_only.sql          (EA gate pattern)
--   20260819062423_hr_rls_helper_calls_as_initplan.sql    ((select ...) helpers)
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. Override / audit table ───────────────────────────────────────────────
create table if not exists hr.attendance_regularization (
  id                   uuid primary key default gen_random_uuid(),
  subject_id           uuid not null,
  work_date            date not null,
  new_status           text not null,
  in_at                timestamptz,
  out_at               timestamptz,
  worked_minutes       integer,
  reason               text not null,
  prev_status          text,                       -- what the view showed before (audit)
  regularized_by       uuid not null default auth.uid(),
  regularized_by_email text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint attreg_status_check check (new_status = any (array[
    'present','late','absent','week_off','holiday',
    'casual','emergency','sick','half_day','short_leave','uninformed'])),
  constraint attreg_reason_not_blank check (length(btrim(reason)) > 0),
  constraint attreg_one_per_day unique (subject_id, work_date)
);

comment on table hr.attendance_regularization is
  'EA-authored corrections to past attendance days. Honoured by hr.attendance_day with top precedence. EA-only, reason mandatory, cannot target own record.';

create index if not exists attreg_subject_date_idx
  on hr.attendance_regularization (subject_id, work_date);

-- keep updated_at honest
create or replace function hr.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists attreg_touch on hr.attendance_regularization;
create trigger attreg_touch before update on hr.attendance_regularization
  for each row execute function hr.touch_updated_at();

-- ── 2. Authorization gate — attendance authority = HR (hr.admin) ─────────────
create or replace function hr.is_attendance_regularizer()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid()
      and is_active = true
      and lower(email) in ('hr.admin@hagerstone.com')   -- HR owns attendance corrections
  );
$$;
grant execute on function hr.is_attendance_regularizer() to authenticated, service_role;

-- ── 3. RLS — read for admins + the subject; write for HR, never own record ───
alter table hr.attendance_regularization enable row level security;

drop policy if exists "attreg_read" on hr.attendance_regularization;
create policy "attreg_read" on hr.attendance_regularization for select to authenticated
  using ((select hr.is_hr_admin()) or subject_id = (select hr.my_employee_id()));

drop policy if exists "attreg_ea_insert" on hr.attendance_regularization;
create policy "attreg_ea_insert" on hr.attendance_regularization for insert to authenticated
  with check ((select hr.is_attendance_regularizer())
              and subject_id <> (select hr.my_employee_id()));

drop policy if exists "attreg_ea_update" on hr.attendance_regularization;
create policy "attreg_ea_update" on hr.attendance_regularization for update to authenticated
  using ((select hr.is_attendance_regularizer())
         and subject_id <> (select hr.my_employee_id()))
  with check ((select hr.is_attendance_regularizer())
              and subject_id <> (select hr.my_employee_id()));

drop policy if exists "attreg_ea_delete" on hr.attendance_regularization;
create policy "attreg_ea_delete" on hr.attendance_regularization for delete to authenticated
  using ((select hr.is_attendance_regularizer())
         and subject_id <> (select hr.my_employee_id()));

grant select, insert, update, delete on hr.attendance_regularization to authenticated;
grant select on hr.attendance_regularization to service_role;

-- ── 4. Convenience RPC — validates, stamps who/when, upserts ─────────────────
-- SECURITY DEFINER but re-checks the EA gate + self-exclusion + reason itself,
-- so it cannot be used to bypass the controls above.
create or replace function hr.regularize_attendance(
  p_subject_id uuid,
  p_work_date  date,
  p_status     text,
  p_reason     text,
  p_in_at      timestamptz default null,
  p_out_at     timestamptz default null,
  p_prev_status text default null
) returns hr.attendance_regularization
language plpgsql security definer set search_path to 'public', 'hr' as $$
declare r hr.attendance_regularization;
begin
  if not hr.is_attendance_regularizer() then
    raise exception 'Only the EA may regularize attendance';
  end if;
  if p_subject_id = hr.my_employee_id() then
    raise exception 'You cannot regularize your own attendance (segregation of duties)';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;

  insert into hr.attendance_regularization as ar
    (subject_id, work_date, new_status, in_at, out_at, reason, prev_status,
     regularized_by, regularized_by_email)
  values
    (p_subject_id, p_work_date, p_status, p_in_at, p_out_at, btrim(p_reason), p_prev_status,
     auth.uid(),
     (select lower(email) from public.employees where auth_user_id = auth.uid() limit 1))
  on conflict (subject_id, work_date) do update
    set new_status           = excluded.new_status,
        in_at                = excluded.in_at,
        out_at               = excluded.out_at,
        reason               = excluded.reason,
        prev_status          = coalesce(excluded.prev_status, ar.prev_status),
        regularized_by       = excluded.regularized_by,
        regularized_by_email = excluded.regularized_by_email,
        updated_at           = now()
  returning * into r;
  return r;
end;
$$;
grant execute on function hr.regularize_attendance(uuid, date, text, text, timestamptz, timestamptz, text)
  to authenticated;

-- ── 5. Rebuild attendance_day so overrides win ──────────────────────────────
-- Faithful copy of 20260814074535_attendance_coverage_gap_blackout.sql, plus a
-- LEFT JOIN to hr.attendance_regularization whose values take precedence in
-- day_status / in_at / out_at / worked_minutes / ot_minutes / day_credit, and
-- which also forces the day to be emitted even inside the coverage gap.
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
           FROM win w
             CROSS JOIN LATERAL generate_series(w.from_date::timestamp with time zone, w.to_date::timestamp with time zone, '1 day'::interval) d_1(d)
        )
 SELECT s.subject_id, sub.subject_kind, sub.full_name, sub.employee_code, sub.department,
    s.work_date,
    COALESCE(reg.in_at, d.in_at)  AS in_at,
    COALESCE(reg.out_at, d.out_at) AS out_at,
    d.punch_count, d.site_name, d.photo, d.admin_notes,
    CASE WHEN reg.new_status IS NOT NULL THEN 'regularized'::text
         ELSE COALESCE(d.source, 'none'::text) END AS source,
    d.any_unverified,
    COALESCE(
      CASE
        WHEN COALESCE(reg.in_at, d.in_at) IS NOT NULL
         AND COALESCE(reg.out_at, d.out_at) IS NOT NULL
         AND COALESCE(reg.out_at, d.out_at) > COALESCE(reg.in_at, d.in_at)
        THEN (EXTRACT(epoch FROM COALESCE(reg.out_at, d.out_at) - COALESCE(reg.in_at, d.in_at)) / 60::numeric)::integer
        ELSE NULL::integer
      END,
      reg.worked_minutes
    ) AS worked_minutes,
    CASE
      WHEN COALESCE(reg.in_at, d.in_at) IS NOT NULL
       AND COALESCE(reg.out_at, d.out_at) IS NOT NULL
       AND COALESCE(reg.out_at, d.out_at) > COALESCE(reg.in_at, d.in_at)
      THEN GREATEST(0, (EXTRACT(epoch FROM COALESCE(reg.out_at, d.out_at) - COALESCE(reg.in_at, d.in_at)) / 60::numeric)::integer - c.ot_after_minutes)
      ELSE NULL::integer
    END AS ot_minutes,
    h.holiday_date IS NOT NULL AS is_holiday,
    h.name AS holiday_name,
    (EXTRACT(dow FROM s.work_date)::integer = ANY (c.weekend_dows)) AND NOT sub.works_sunday AS is_week_off,
    lv.leave_type, lv.leave_status,
    COALESCE(reg.new_status,
        CASE
            WHEN h.holiday_date IS NOT NULL THEN 'holiday'::text
            WHEN (EXTRACT(dow FROM s.work_date)::integer = ANY (c.weekend_dows)) AND NOT sub.works_sunday THEN 'week_off'::text
            WHEN d.in_at IS NOT NULL AND (lv.leave_type = ANY (ARRAY['half_day'::text, 'short_leave'::text])) THEN lv.leave_type
            WHEN d.in_at IS NULL AND lv.leave_type IS NOT NULL THEN lv.leave_type
            WHEN d.in_at IS NULL THEN 'absent'::text
            WHEN (d.in_at AT TIME ZONE 'Asia/Kolkata'::text)::time without time zone > c.late_after THEN 'late'::text
            ELSE 'present'::text
        END) AS day_status,
    CASE
        WHEN reg.new_status IS NOT NULL THEN
          CASE reg.new_status
            WHEN 'half_day'::text    THEN 0.5
            WHEN 'short_leave'::text THEN 0.75
            WHEN 'present'::text     THEN 1::numeric
            WHEN 'late'::text        THEN 1::numeric
            ELSE 0::numeric
          END
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
     LEFT JOIN hr.attendance_regularization reg ON reg.subject_id = s.subject_id AND reg.work_date = s.work_date
     LEFT JOIN LATERAL ( SELECT lr.leave_type, lr.status AS leave_status
           FROM hr.leave_requests lr
          WHERE (lr.employee_id = sub.employee_id OR lr.person_ref = sub.person_ref)
            AND (lr.status = ANY (ARRAY['approved'::text, 'pending'::text]))
            AND s.work_date >= lr.start_date AND s.work_date <= lr.end_date
          ORDER BY (CASE lr.status WHEN 'approved'::text THEN 0 ELSE 1 END)
         LIMIT 1) lv ON true
  WHERE (s.work_date <= CURRENT_DATE OR lv.leave_type IS NOT NULL OR reg.new_status IS NOT NULL)
    -- Coverage gap: no punch, no leave, no regularization, inside the window →
    -- the day never happened as far as this system knows. A regularization
    -- forces it back into view.
    AND NOT (
          d.in_at IS NULL
      AND lv.leave_type IS NULL
      AND reg.new_status IS NULL
      AND c.coverage_gap_from IS NOT NULL
      AND s.work_date >= c.coverage_gap_from
      AND s.work_date <= c.coverage_gap_to
    );

-- security_invoker MUST stay set — attendance_day reads RLS-scoped hr.attendance
-- and now hr.attendance_regularization; owner-rights would leak every row.
alter view hr.attendance_day set (security_invoker = true);

-- attendance_month counts from attendance_day, so regularizations roll up
-- automatically — no change needed there.
