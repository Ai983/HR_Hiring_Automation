-- ============================================================================
-- hr_drop_email_authority_gates
--
-- GOVERNANCE SIMPLIFICATION — step 1 of the 3-role redesign (employee / hr_admin
-- / super_admin, all assigned from the employee dashboard, no per-email cases).
--
-- Removes the two authority gates that were keyed to hardcoded email addresses:
--   * hr.is_leave_approver()         = ea@hagerstone.com        (leave decisions)
--   * hr.is_attendance_regularizer() = hr.admin@hagerstone.com  (past-day fixes)
--
-- Both privileged actions now flow from the existing role tier hr.is_hr_admin()
-- (roles admin/hr/founder/management/ai/mis) — which is one of the three roles the
-- redesign keeps. A later migration will re-home hr.is_hr_admin() onto an
-- hr-schema access level written from the employee dashboard and add the
-- super-admin tier; because both privileged writes already call hr.is_hr_admin(),
-- that future change lands in one place.
--
-- CONSEQUENCE (intended): leave approval widens from EA-only back to the whole
-- is_hr_admin tier, and attendance corrections widen from HR-only to the same
-- tier. The deliberate EA/HR split (20260818093922, PENDING_...regularization)
-- is intentionally collapsed here — it was the email-keyed model being removed.
-- Re-split by role in step 2 if the redesign wants distinct tiers.
--
-- PRESERVED: the regularization self-exclusion guard (subject_id <> my own) in
-- both the RPC and the write policies. Nobody edits their own attendance/pay.
-- Whether super-admin may override that is a step-2 decision; not weakened here.
--
-- Also exposes is_hr_admin on hr.my_context() so the client renders the
-- Approve/Reject and Attendance Fix controls from one server-computed boolean
-- instead of a hardcoded email list (src/leaveConfig.js lost those lists).
--
-- Apply AFTER:
--   20260818093922_hr_leave_approval_ea_only.sql
--   20260819062423_hr_rls_helper_calls_as_initplan.sql
--   PENDING_hr_attendance_regularization.sql
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. Leave decisions: EA-only email gate → is_hr_admin role ───────────────
drop policy if exists "leave_approver_edit" on hr.leave_requests;
drop policy if exists "leave_admin_edit"    on hr.leave_requests;
create policy "leave_admin_edit" on hr.leave_requests for update to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

-- ── 2. Attendance regularization: HR-email gate → is_hr_admin role ──────────
-- Self-exclusion preserved: an admin still cannot regularize their own day.
drop policy if exists "attreg_ea_insert"    on hr.attendance_regularization;
drop policy if exists "attreg_admin_insert" on hr.attendance_regularization;
create policy "attreg_admin_insert" on hr.attendance_regularization for insert to authenticated
  with check ((select hr.is_hr_admin())
              and subject_id <> (select hr.my_employee_id()));

drop policy if exists "attreg_ea_update"    on hr.attendance_regularization;
drop policy if exists "attreg_admin_update" on hr.attendance_regularization;
create policy "attreg_admin_update" on hr.attendance_regularization for update to authenticated
  using ((select hr.is_hr_admin())
         and subject_id <> (select hr.my_employee_id()))
  with check ((select hr.is_hr_admin())
              and subject_id <> (select hr.my_employee_id()));

drop policy if exists "attreg_ea_delete"    on hr.attendance_regularization;
drop policy if exists "attreg_admin_delete" on hr.attendance_regularization;
create policy "attreg_admin_delete" on hr.attendance_regularization for delete to authenticated
  using ((select hr.is_hr_admin())
         and subject_id <> (select hr.my_employee_id()));

-- ── 3. RPC: re-gate on is_hr_admin, keep self-exclusion + mandatory reason ──
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
  if not hr.is_hr_admin() then
    raise exception 'Only an HR admin may regularize attendance';
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

-- ── 4. Expose is_hr_admin on my_context so the UI gates on a role, not email ─
-- Faithful copy of hub-migration/02-attendance-sso.sql with one new field.
create or replace function hr.my_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select e.id, e.name, e.email, e.role, e.employee_code,
           coalesce(p.track_location, false) as track_location
    from public.employees e
    left join hr.employee_profile p on p.employee_id = e.id
    where e.auth_user_id = auth.uid() and e.is_active = true
    limit 1
  ),
  role_mods as (
    select unnest(coalesce(r.default_modules, '{}')::text[]) m
    from me join public.roles r on r.id = me.role
  ),
  grants as (
    select ema.module_id m, ema.can_access
    from public.employee_module_access ema
    join me on me.id = ema.employee_id
  ),
  effective as (
    select m from role_mods
    union
    select m from grants where can_access
    except
    select m from grants where not can_access
  )
  select case when exists (select 1 from me) then
    jsonb_build_object(
      'employee_id',   (select id from me),
      'employee_code', (select employee_code from me),
      'name',          (select name from me),
      'email',         (select email from me),
      'role',          (select role from me),
      'track_location',(select track_location from me),
      'is_hr_admin',   hr.is_hr_admin(),
      'modules', coalesce((select jsonb_agg(m order by m) from effective), '[]'::jsonb)
    )
  else null end;
$$;
grant execute on function hr.my_context() to anon, authenticated, service_role;

-- ── 5. Drop the email-keyed gates (nothing references them now) ─────────────
drop function if exists hr.is_leave_approver();
drop function if exists hr.is_attendance_regularizer();
