-- ============================================================================
-- hr_three_role_access_model
--
-- GOVERNANCE SIMPLIFICATION — step 2 of the 3-role redesign.
--
-- The system now has exactly THREE access levels, stored in the hr schema and
-- assigned from the employee dashboard (public.roles / public.employees.role are
-- read-only from this repo, so authority cannot live there):
--
--   employee     — self service only (punch, own history, own leave)
--   hr_admin     — all day-to-day attendance & leave ops for ANYONE:
--                  approve/reject leave, mark/backfill attendance, manage
--                  sites/geofence/roster/office-team, edit profiles + PINs.
--                  CANNOT edit/delete existing punches, regularize past days,
--                  change the time/rules, or assign roles.
--   super_admin  — everything hr_admin can do, PLUS edit/delete punches,
--                  regularize past attendance (Attendance Fix), change the
--                  time/rules (attendance_settings + holidays), and assign
--                  roles. Full control for anyone, including themselves.
--
-- Mechanics:
--   * New column hr.employee_profile.access_level drives everything.
--   * hr.is_hr_admin() is re-homed onto access_level (true for hr_admin OR
--     super_admin), so every existing policy that already calls it follows the
--     new model with no further edits.
--   * hr.is_super_admin() is the new top tier.
--   * A guard trigger blocks anyone but a super_admin from changing access_level
--     (defence in depth over the profile write policy), and hr.set_access_level()
--     is the clean RPC the dashboard calls.
--   * attendance_settings + holidays writes move from is_hr_admin to is_super_admin.
--   * Regularization (the Attendance Fix panel) is super_admin only.
--
-- Apply AFTER 20260827120000_hr_drop_email_authority_gates.sql. Idempotent.
--
-- ⚠ REQUIRED EDITS before running: fill the hr_admin emails (section 2) and the
-- super_admin email(s) (section 3). Everyone NOT named in either list becomes a
-- plain 'employee' — this is the clean 3-role reset. Without at least one
-- super_admin, nobody can change the rules or assign roles.
-- ============================================================================

-- ── 1. The access-level column ──────────────────────────────────────────────
alter table hr.employee_profile
  add column if not exists access_level text not null default 'employee';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'employee_profile_access_level_chk') then
    alter table hr.employee_profile add constraint employee_profile_access_level_chk
      check (access_level in ('employee','hr_admin','super_admin'));
  end if;
end $$;

comment on column hr.employee_profile.access_level is
  'HireFlow access tier: employee | hr_admin | super_admin. Assigned from the employee dashboard by a super_admin. Drives hr.is_hr_admin() / hr.is_super_admin().';

-- ── 2. Assign the hr_admin role (exactly the people who run day-to-day ops) ──
-- ⚠ EDIT the email list. Everyone NOT named here (and not a super_admin in
-- section 3) stays 'employee'. Roles can also be changed later from the
-- dashboard. The WHERE guard keeps a re-run from clobbering deliberate changes.
insert into hr.employee_profile as ep (employee_id, access_level)
select e.id, 'hr_admin'
from public.employees e
where e.is_active
  and lower(e.email) in (
    'ea@hagerstone.com',
    'ashishgayatri98@gmail.com'
  )
on conflict (employee_id) do update
  set access_level = 'hr_admin', updated_at = now()
  where ep.access_level = 'employee';

-- ── 3. BOOTSTRAP the first super admin(s) ───────────────────────────────────
-- ⚠ EDIT the email list. One-time data seed, NOT an ongoing email gate — the
-- dashboard assigns every role from here on.
insert into hr.employee_profile as ep (employee_id, access_level)
select e.id, 'super_admin'
from public.employees e
where e.is_active
  and lower(e.email) in ('ai@hagerstone.com')
on conflict (employee_id) do update
  set access_level = 'super_admin', updated_at = now();

-- ── 3b. Loud check: every seeded email must match an active employee ─────────
-- A typo or an unlinked account would otherwise silently grant nobody. This
-- warns (does not abort) so the valid grants still land and the operator sees
-- exactly which address to fix.
do $$
declare missing text;
begin
  select string_agg(v.email, ', ') into missing
  from (values
    ('ea@hagerstone.com'),
    ('ashishgayatri98@gmail.com'),
    ('ai@hagerstone.com')
  ) as v(email)
  where not exists (
    select 1 from public.employees e
    where lower(e.email) = v.email and e.is_active
  );
  if missing is not null then
    raise warning 'Access-level seed: no active employee found for: %  — NOT granted a role', missing;
  end if;
end $$;

-- ── 4. The gates now read access_level ──────────────────────────────────────
create or replace function hr.is_super_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
    from public.employees e
    join hr.employee_profile p on p.employee_id = e.id
    where e.auth_user_id = auth.uid()
      and e.is_active = true
      and p.access_level = 'super_admin'
  );
$$;
grant execute on function hr.is_super_admin() to authenticated, service_role;

-- Re-homed onto access_level. super_admin is a superset of hr_admin.
create or replace function hr.is_hr_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
    from public.employees e
    join hr.employee_profile p on p.employee_id = e.id
    where e.auth_user_id = auth.uid()
      and e.is_active = true
      and p.access_level in ('hr_admin','super_admin')
  );
$$;
grant execute on function hr.is_hr_admin() to authenticated, service_role;

-- ── 5. Guard: only a super_admin may change access_level ─────────────────────
-- Created AFTER the seeds above (which run as the SQL-editor superuser with a
-- null auth.uid(), and would otherwise be blocked).
create or replace function hr.guard_access_level()
returns trigger language plpgsql security definer set search_path to 'public', 'hr' as $$
begin
  if tg_op = 'INSERT' then
    if new.access_level is distinct from 'employee' and not hr.is_super_admin() then
      raise exception 'Only a super admin may set an access level';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.access_level is distinct from old.access_level and not hr.is_super_admin() then
      raise exception 'Only a super admin may change an access level';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists employee_profile_access_guard on hr.employee_profile;
create trigger employee_profile_access_guard
  before insert or update on hr.employee_profile
  for each row execute function hr.guard_access_level();

-- ── 6. RPC the dashboard calls to assign a role ─────────────────────────────
-- super_admin only, enum-checked, upserts, and refuses to remove the LAST
-- super admin (which would lock everyone out of the rules + role assignment).
create or replace function hr.set_access_level(p_employee_id uuid, p_level text)
returns hr.employee_profile
language plpgsql security definer set search_path to 'public', 'hr' as $$
declare r hr.employee_profile;
begin
  if not hr.is_super_admin() then
    raise exception 'Only a super admin may assign access levels';
  end if;
  if p_level not in ('employee','hr_admin','super_admin') then
    raise exception 'Invalid access level: %', p_level;
  end if;
  if p_level <> 'super_admin'
     and exists (select 1 from hr.employee_profile
                  where employee_id = p_employee_id and access_level = 'super_admin')
     and (select count(*) from hr.employee_profile where access_level = 'super_admin') <= 1 then
    raise exception 'Cannot remove the last super admin';
  end if;

  insert into hr.employee_profile as ep (employee_id, access_level)
  values (p_employee_id, p_level)
  on conflict (employee_id) do update
    set access_level = excluded.access_level, updated_at = now()
  returning * into r;
  return r;
end;
$$;
grant execute on function hr.set_access_level(uuid, text) to authenticated;

-- ── 7. Time / rules become super-admin only (hr_admin cannot change these) ───
drop policy if exists settings_write on hr.attendance_settings;
create policy settings_write on hr.attendance_settings for all to authenticated
  using ((select hr.is_super_admin())) with check ((select hr.is_super_admin()));

drop policy if exists holidays_write on hr.holidays;
create policy holidays_write on hr.holidays for all to authenticated
  using ((select hr.is_super_admin())) with check ((select hr.is_super_admin()));

-- ── 8. Regularization (Attendance Fix) is super_admin only ──────────────────
drop policy if exists "attreg_admin_insert" on hr.attendance_regularization;
drop policy if exists "attreg_super_insert" on hr.attendance_regularization;
create policy "attreg_super_insert" on hr.attendance_regularization for insert to authenticated
  with check ((select hr.is_super_admin()));

drop policy if exists "attreg_admin_update" on hr.attendance_regularization;
drop policy if exists "attreg_super_update" on hr.attendance_regularization;
create policy "attreg_super_update" on hr.attendance_regularization for update to authenticated
  using ((select hr.is_super_admin()))
  with check ((select hr.is_super_admin()));

drop policy if exists "attreg_admin_delete" on hr.attendance_regularization;
drop policy if exists "attreg_super_delete" on hr.attendance_regularization;
create policy "attreg_super_delete" on hr.attendance_regularization for delete to authenticated
  using ((select hr.is_super_admin()));

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
  if not hr.is_super_admin() then
    raise exception 'Only a super admin may regularize attendance';
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

-- ── 8b. Raw attendance edit/delete → super_admin only ───────────────────────
-- hr_admin keeps INSERT (day-to-day marking / backfill) + read, but rewriting
-- or deleting an existing punch is history-altering, so it is reserved for
-- super_admin — the same authority as regularization. The self/hr_admin
-- SELECT + INSERT policies from rls-hardening are left untouched.
drop policy if exists "attendance_admin_edit" on hr.attendance;
create policy "attendance_admin_edit" on hr.attendance for update to authenticated
  using ((select hr.is_super_admin())) with check ((select hr.is_super_admin()));

drop policy if exists "attendance_admin_del" on hr.attendance;
create policy "attendance_admin_del" on hr.attendance for delete to authenticated
  using ((select hr.is_super_admin()));

-- ── 9. Expose is_super_admin (and keep is_hr_admin) on my_context ───────────
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
      'is_hr_admin',    hr.is_hr_admin(),
      'is_super_admin', hr.is_super_admin(),
      'modules', coalesce((select jsonb_agg(m order by m) from effective), '[]'::jsonb)
    )
  else null end;
$$;
grant execute on function hr.my_context() to anon, authenticated, service_role;
