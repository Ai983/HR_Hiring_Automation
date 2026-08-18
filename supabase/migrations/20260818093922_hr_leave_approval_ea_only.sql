-- ============================================================================
-- Leave approval belongs to EA, and only from inside the portal.
--
-- hr.is_leave_approver() is a narrower gate than hr.is_hr_admin(). Every HR/admin
-- role keeps read access to hr.leave_requests (the panel, the stats, the CSV
-- export), but only the approver may write a decision. Before this, all 12
-- admin-tier logins could approve; now only EA can.
--
-- Matched on email rather than role because "EA" is a person, not a tier: the
-- admin roles are shared by a dozen people and we do not want any of them
-- inheriting the right to approve leave.
--
-- No role change is needed: ea@hagerstone.com (Ritu Sharma, HAG-018) already
-- carries role 'admin' with a linked auth user, so the Leave Requests panel is
-- already reachable for her.
--
-- NOTE: a second person holds role 'ea' (Ritu Ma'am, ritudesaiwal@gmail.com,
-- HAG-037). That role grants only the 'attendance' module and is NOT the address
-- the leave mail goes to, so she is deliberately not an approver here.
--
-- Mirrors src/leaveConfig.js -> LEAVE_APPROVER_EMAILS. If you add a second
-- approver there, add it here too: the client list only decides which buttons
-- render, this one decides who may actually write.
--
-- Applied to the hub project (tpfvnerrjhqwipyonngf) on 2026-08-18.
-- Idempotent: safe to re-run.
-- ============================================================================

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
