-- HireFlow: Run this ONCE in Supabase Dashboard → SQL Editor
-- Project: sgerslbmnwrltqrhsdir
-- Order: schema (jobs + applicants) → questionnaires → storage policies
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where needed.

-- ========== 1. SCHEMA (jobs + applicants) ==========
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  dept text,
  location text,
  type text default 'Full-time',
  exp text,
  salary text,
  jd text,
  jd_linkedin text,
  jd_indeed text,
  jd_jobhai text,
  jd_apna text,
  skills jsonb default '[]'::jsonb,
  portal_status jsonb default '{
    "linkedin": {"status": "draft", "applicants": 0, "views": 0},
    "indeed":   {"status": "draft", "applicants": 0, "views": 0},
    "jobhai":   {"status": "draft", "applicants": 0, "views": 0},
    "apna":     {"status": "draft", "applicants": 0, "views": 0}
  }'::jsonb,
  posted_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  portal text not null check (portal in ('linkedin','indeed','jobhai','apna')),
  resume_path text,
  resume_text text,
  stage text not null default 'new' check (stage in ('new','screening','interview','offer','hired','rejected')),
  ai_score int check (ai_score is null or (ai_score >= 0 and ai_score <= 100)),
  shortlisted boolean default false,
  screening_notes text,
  applied_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_applicants_job_id on public.applicants(job_id);
create index if not exists idx_applicants_stage on public.applicants(stage);
create index if not exists idx_applicants_shortlisted on public.applicants(shortlisted);
create index if not exists idx_applicants_email on public.applicants(email);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_updated_at on public.jobs;
create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

drop trigger if exists applicants_updated_at on public.applicants;
create trigger applicants_updated_at
  before update on public.applicants
  for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;
alter table public.applicants enable row level security;

drop policy if exists "Allow all on jobs" on public.jobs;
create policy "Allow all on jobs" on public.jobs for all using (true) with check (true);
drop policy if exists "Allow all on applicants" on public.applicants;
create policy "Allow all on applicants" on public.applicants for all using (true) with check (true);

comment on table public.jobs is 'Job postings; each row is one role. Portal status per LinkedIn, Indeed, JobHai, Apna.';
comment on table public.applicants is 'All applicants stored with job_id (role) and resume for future contact even if not shortlisted.';

-- ========== 2. QUESTIONNAIRES ==========
create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  interview_type text not null check (interview_type in ('hr', 'director')),
  custom_topics text,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_questionnaires_job_id on public.questionnaires(job_id);
alter table public.questionnaires enable row level security;
drop policy if exists "Allow all on questionnaires" on public.questionnaires;
create policy "Allow all on questionnaires" on public.questionnaires for all using (true) with check (true);
comment on table public.questionnaires is 'AI-generated interview questionnaires per job. Sections stored as JSONB array.';

-- ========== 3. STORAGE POLICIES (resumes bucket) ==========
-- Requires bucket "resumes" to exist (you already created it).
drop policy if exists "Allow uploads to resumes" on storage.objects;
create policy "Allow uploads to resumes" on storage.objects for insert to public with check (bucket_id = 'resumes');

drop policy if exists "Allow read from resumes" on storage.objects;
create policy "Allow read from resumes" on storage.objects for select to public using (bucket_id = 'resumes');

drop policy if exists "Allow update resumes" on storage.objects;
create policy "Allow update resumes" on storage.objects for update to public using (bucket_id = 'resumes');

drop policy if exists "Allow delete resumes" on storage.objects;
create policy "Allow delete resumes" on storage.objects for delete to public using (bucket_id = 'resumes');
