-- HireFlow: Questionnaires table
-- Run this in Supabase Dashboard -> SQL Editor (after schema.sql)

create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  interview_type text not null check (interview_type in ('hr', 'director')),
  custom_topics text,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_questionnaires_job_id on public.questionnaires(job_id);

-- RLS
alter table public.questionnaires enable row level security;
create policy "Allow all on questionnaires" on public.questionnaires for all using (true) with check (true);

comment on table public.questionnaires is 'AI-generated interview questionnaires per job. Sections stored as JSONB array.';
