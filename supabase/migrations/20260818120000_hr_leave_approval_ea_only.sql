-- ============================================================================
-- Leave approval belongs to EA, and only from inside the portal.
--
-- hr.is_leave_approver() is a narrower gate than hr.is_hr_admin(). Every HR/admin
-- role keeps read access to hr.leave_requests (the panel, the stats, the CSV
-- export), but only the approver may write a decision.
--
-- Before this, all 12 admin-tier logins could approve. Now only EA can.
--
-- No role change is needed: ea@hagerstone.com (Ritu Sharma, HAG-018) already
-- carries role 'admin' with a linked auth user, so the Leave Requests panel is
-- already reachable for her. The check at the bottom asserts that rather than
-- assuming it — if the row is ever renamed or deactivated, nobody can approve
-- leave at all, and that should fail loudly here rather than silently in the UI.
--
-- NOTE: a second person holds role 'ea' (Ritu Ma'am, ritudesaiwal@gmail.com,
-- HAG-037). That role grants only the 'attendance' module and is NOT the address
-- the leave mail goes to, so she is deliberately not an approver here.
--
-- Mirrors src/leaveConfig.js → LEAVE_APPROVER_EMAILS. If you add a second
-- approver there, add it here too: the client list only decides which buttons
-- render, this one decides who may actually write.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. approver gate ────────────────────────────────────────────────────────
-- Matched on email rather than role because "EA" is a person, not a tier: the
-- admin roles are shared by half a dozen people and we do not want any of them
-- inheriting the right to approve leave.
create or replace function hr.is_leave_approver()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid()
      and is_active = true
      and lower(email) in ('ea@hagerstone.com')
  );
$$;

grant execute on function hr.is_leave_approver() to authenticated, service_role;

-- Replaces the old "any hr admin may update" policy from rls-hardening-golive.sql.
-- SELECT / INSERT / DELETE policies are deliberately left untouched.
drop policy if exists "leave_admin_edit"    on hr.leave_requests;
drop policy if exists "leave_approver_edit" on hr.leave_requests;
create policy "leave_approver_edit" on hr.leave_requests for update to authenticated
  using (hr.is_leave_approver()) with check (hr.is_leave_approver());

-- ── 2. assert EA can still get in ───────────────────────────────────────────
-- Read-only. Narrowing the policy above means a broken EA row locks approval for
-- everyone, so surface that here instead of leaving it to be discovered when
-- somebody's leave sits pending for a week.
do $$
declare
  v_role text;
  v_auth uuid;
  v_live boolean;
begin
  select role, auth_user_id, is_active into v_role, v_auth, v_live
  from public.employees where lower(email) = 'ea@hagerstone.com' limit 1;

  if v_role is null then
    raise warning 'No public.employees row for ea@hagerstone.com — nobody can approve leave until one exists.';
  elsif v_auth is null or v_live is not true then
    raise warning 'ea@hagerstone.com exists (role %) but is_active=% / auth_user_id=% — she cannot sign in, so nobody can approve leave.', v_role, v_live, v_auth;
  elsif v_role not in ('admin','hr','founder','management','ai','mis') then
    raise warning 'ea@hagerstone.com has role %, which hr.is_hr_admin() does not accept — the Leave Requests panel will not load for her.', v_role;
  else
    raise notice 'ea@hagerstone.com OK: role %, active, auth linked.', v_role;
  end if;
end $$;
