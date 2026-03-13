-- Run this in Supabase Dashboard → SQL Editor (after the "resumes" bucket exists)
-- This allows your app (anon key) to upload and read resume files.

-- Allow upload (insert) into resumes bucket
create policy "Allow uploads to resumes"
on storage.objects for insert
to public
with check (bucket_id = 'resumes');

-- Allow read (select) from resumes bucket
create policy "Allow read from resumes"
on storage.objects for select
to public
using (bucket_id = 'resumes');

-- Optional: allow update/delete so HR can replace or remove a resume
create policy "Allow update resumes"
on storage.objects for update
to public
using (bucket_id = 'resumes');

create policy "Allow delete resumes"
on storage.objects for delete
to public
using (bucket_id = 'resumes');
