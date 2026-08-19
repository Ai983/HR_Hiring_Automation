-- ============================================================================
-- NOT YET APPLIED -- needs your approval.
--
-- Rename to a timestamped filename (e.g. 20260819HHMMSS_...) once applied, to
-- match the convention in this folder.
--
-- FINDING (verified live on 2026-08-19 with the public anon key, the same one
-- that ships inside the browser bundle):
--
--   anon GET hr.attendance_rollout_backup  -> 200, rows returned
--
-- hr.attendance_rollout_backup is a leftover snapshot taken around the portal
-- rollout: 27 punches spanning 2026-07-28 .. 2026-08-11, of which 26 carry a
-- selfie URL and 19 carry a GPS fix plus the resolved home/site address. It
-- shipped with RLS OFF and a SELECT grant to anon, so anyone who opens devtools
-- can read the exact data hr.attendance itself is careful to scope per
-- employee. Supabase's security advisor flags it as `rls_disabled_in_public`.
--
-- Nothing in src/, supabase/functions/ or n8n-workflows/ references this table.
-- Edge functions and n8n use the service-role key, which bypasses RLS, so
-- backend access is unaffected. Only anon/authenticated browser reads change.
--
-- Kept rather than dropped, because it is a rollout-period backup and dropping
-- data is not reversible. Locked to HR/admin to match the rest of the module.
-- If you would rather it not exist at all, drop it instead -- but confirm the
-- 27 rows are all present in hr.attendance first.
-- ============================================================================

alter table hr.attendance_rollout_backup enable row level security;

revoke all on hr.attendance_rollout_backup from anon;

drop policy if exists rollout_backup_admin on hr.attendance_rollout_backup;
create policy rollout_backup_admin on hr.attendance_rollout_backup for all to authenticated
  using ((select hr.is_hr_admin())) with check ((select hr.is_hr_admin()));

-- VERIFY: expect 0 rows for anon afterwards.
--   curl -s "$URL/rest/v1/attendance_rollout_backup?select=*&limit=1" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Accept-Profile: hr"
