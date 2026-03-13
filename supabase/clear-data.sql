-- Run this in Supabase Dashboard → SQL Editor to clear all jobs and applicants for testing.
-- Resumes in Storage are NOT deleted; delete them manually from Storage if needed.

delete from public.applicants;
delete from public.jobs;

-- Optional: reset sequences if you use serial ids (this schema uses uuid, so not needed)
-- alter sequence jobs_id_seq restart with 1;
