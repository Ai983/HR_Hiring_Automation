-- ============================================================
-- 02-attendance-sso.sql
-- Applied to the hub project (tpfvnerrjhqwipyonngf).
-- Captures the DB change made for universal Hagerstone Hub login (SSO):
-- hr.my_context() resolves the signed-in user -> employee identity + effective
-- module access (role defaults ∪ explicit grants − explicit revokes).
-- Idempotent: safe to re-run.
-- ============================================================

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
      'modules', coalesce((select jsonb_agg(m order by m) from effective), '[]'::jsonb)
    )
  else null end;
$$;

grant execute on function hr.my_context() to anon, authenticated, service_role;
