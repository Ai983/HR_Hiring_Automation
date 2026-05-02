-- Optional: Restrict jobs and applicants to signed-in HR only.
-- Run this AFTER schema.sql if you want only authenticated users to access data.
-- Requires Supabase Auth (email/password) to be enabled.

drop policy if exists "Allow all on jobs" on public.jobs;
drop policy if exists "Allow all on applicants" on public.applicants;

create policy "Authenticated read/write jobs"
on public.jobs for all
to authenticated
using (true)
with check (true);

create policy "Authenticated read/write applicants"
on public.applicants for all
to authenticated
using (true)
with check (true);
