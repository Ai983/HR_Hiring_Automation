-- =====================================================================
-- Website careers intake  ·  19 Nov 2026
-- ---------------------------------------------------------------------
-- hagerstone.com/careers lists six openings and takes applications with a
-- resume. Every submission lands in hr.applicants at stage 'new', tagged
-- portal = 'website', so it appears in the Kanban HR already works from and
-- in the new "Website Applications" panel. There is no second inbox.
--
-- The website is a DIFFERENT Supabase project (Hager-Website). It never
-- talks to these tables: it posts a multipart form to the `website-apply`
-- edge function here, which writes on the service-role key. Same shape as
-- `apply` and `assessment` — anon gets nothing.
--
-- WHY portal = 'website', not 'form'
-- 'form' is the shareable /apply.html link HR sends by hand. 'website' is a
-- stranger who found the careers page. HR asks "where are applicants coming
-- from?" and the two answer it differently. A new source always means
-- widening applicants_portal_check.
--
-- WHY hr.jobs.website_slug
-- The website applies to /careers/<slug>. The function maps slug -> job so
-- the applicant is attached to a real opening (and screen-resume can score
-- them against its JD) instead of arriving with job_id NULL like /apply.html.
-- Unique where set; NULL for every job not advertised on the website.
--
-- WHY A PRIVATE BUCKET (candidate-resumes)
-- The existing `resumes` bucket is public and its storage policy
-- `hr_resumes_all` grants ALL to role public. A careers page invites CVs from
-- anyone on the internet; those CVs carry phone numbers and home addresses
-- and must not be one URL away from being read. HR opens them through a
-- 5-minute signed URL (ApplicantModal → "View resume"), same as
-- offer-letters. The policy is scoped to bucket_id = 'candidate-resumes' —
-- this is a SHARED hub project and an unscoped storage policy would leak
-- other products' files.
--
-- Additive and idempotent. Every new column is nullable; no existing row
-- changes except the Site Engineer job whose JD was the placeholder
-- 'dagvzxc' (guarded on that exact value).
-- =====================================================================

-- ── 1. 'website' becomes a valid source ─────────────────────────────────
alter table hr.applicants drop constraint if exists applicants_portal_check;
alter table hr.applicants
  add constraint applicants_portal_check
  check (portal = any (array[
    'linkedin','indeed','jobhai','apna','facebook','instagram',
    'email','whatsapp','manual',
    'form',                      -- candidate self-application via /apply.html
    'website'                    -- hagerstone.com/careers
  ]));

-- ── 2. What the careers form collects that the table did not have ───────
alter table hr.applicants add column if not exists qualification    text;
alter table hr.applicants add column if not exists current_employer text;
alter table hr.applicants add column if not exists cover_note       text;
alter table hr.applicants add column if not exists resume_bucket    text;
alter table hr.applicants add column if not exists source_url       text;
alter table hr.applicants add column if not exists consent_at       timestamptz;

comment on column hr.applicants.qualification is
  'Highest qualification as typed by the candidate (website careers form).';
comment on column hr.applicants.current_employer is
  'Current / last employer as typed by the candidate. Self-reported.';
comment on column hr.applicants.cover_note is
  'Optional free-text note from the careers form. Capped at 1500 chars by website-apply.';
comment on column hr.applicants.resume_bucket is
  'Storage bucket holding resume_path. NULL means the legacy public `resumes` bucket.';
comment on column hr.applicants.source_url is
  'Page the candidate applied from (e.g. https://hagerstone.com/careers/site-engineer).';
comment on column hr.applicants.consent_at is
  'When the candidate ticked consent to store their details and CV for this application.';

-- ── 3. Map website openings to jobs ─────────────────────────────────────
alter table hr.jobs add column if not exists website_slug text;
comment on column hr.jobs.website_slug is
  'Slug of the hagerstone.com/careers/<slug> page that applies to this job. NULL = not on the website.';
create unique index if not exists jobs_website_slug_uniq
  on hr.jobs (website_slug) where website_slug is not null;

-- Existing jobs that the website advertises. Matched on exact title; each of
-- these titles is a single row today.
update hr.jobs set website_slug = 'site-engineer'
 where title = 'Site Engineer' and website_slug is null
   and not exists (select 1 from hr.jobs where website_slug = 'site-engineer');
update hr.jobs set website_slug = 'interior-designer'
 where title = 'Interior Designer' and website_slug is null
   and not exists (select 1 from hr.jobs where website_slug = 'interior-designer');
update hr.jobs set website_slug = 'procurement-executive'
 where title = 'Procurement Executive' and website_slug is null
   and not exists (select 1 from hr.jobs where website_slug = 'procurement-executive');

-- The Site Engineer row's JD is the keyboard-mash placeholder 'dagvzxc', which
-- screen-resume would score every applicant against. Replace it only if it is
-- still exactly that.
update hr.jobs set jd =
'Site Engineer - Office Interior Design & Build Projects
Location: Noida, with postings to project sites across India
Experience: 3+ years as a Site Engineer in interior fit-out or design-build

Responsibilities
- Supervise on-site work so it is executed to drawings, specifications and quality standards, on schedule.
- Plan and sequence tasks for each section of the site so handovers and milestones are met.
- Manage skilled labour and subcontractors and allocate them for productivity.
- Monitor site inventory and coordinate with procurement so materials arrive on time.
- Run regular inspections for quality and safety compliance and close out non-conformities.
- Keep records of progress, material use and manpower; prepare daily and weekly reports.

Requirements
- B.E./B.Tech or Diploma in Civil Engineering, or a degree in Interior Design.
- Minimum 3 years as a Site Engineer in interior fit-out or design-build.
- Able to read drawings and BOQs; working knowledge of fit-out materials and methods.
- MS Office; willing to work at project sites across India.',
  skills = '["Site execution","Interior fit-out","Drawing reading","BOQ","Subcontractor management","Quality checks"]'::jsonb,
  location = coalesce(nullif(location, ''), 'Noida'),
  exp = coalesce(nullif(exp, ''), '3+ years'),
  updated_at = now()
 where title = 'Site Engineer' and jd = 'dagvzxc';

-- New jobs for the three website openings HireFlow did not have.
insert into hr.jobs (title, dept, location, type, exp, jd, skills, website_slug, posted_date)
select 'MEP Engineer', 'General', 'Noida', 'Full-time', '',
'MEP Engineer - Commercial Interiors & Building Projects
Location: Noida, with postings to project sites across India

Responsibilities
- Review MEP design and shop drawings; coordinate service routes with the civil and interior teams, including ceiling-void coordination.
- Supervise subcontractors installing electrical (LT panels, cabling, lighting, earthing), HVAC (ducting, refrigerant and chilled-water piping, indoor units), plumbing and drainage, fire-fighting and fire-alarm systems.
- Prepare quantity take-offs and raise material requests in time for each work front.
- Run inspections, testing and commissioning; keep checklists and test records.
- Measure completed work and verify subcontractor bills.
- Compile as-built drawings and handover documents.

Requirements
- B.E./B.Tech or Diploma in Electrical or Mechanical Engineering.
- Site execution experience in MEP services on commercial buildings or interior fit-outs.
- Able to read MEP drawings; AutoCAD and MS Excel.
- Working knowledge of the National Building Code of India 2016, Part 4 (Fire and Life Safety) and Part 8 (Building Services).
- Willing to work at project sites across India.',
  '["MEP execution","Electrical","HVAC","Plumbing","Fire fighting","Testing & commissioning","AutoCAD"]'::jsonb,
  'mep-engineer', current_date
where not exists (select 1 from hr.jobs where website_slug = 'mep-engineer');

insert into hr.jobs (title, dept, location, type, exp, jd, skills, website_slug, posted_date)
select 'Civil Engineer', 'General', 'Noida', 'Full-time', '',
'Civil Engineer - Construction, PEB & Fit-out Projects
Location: Noida, with postings to project sites across India

Responsibilities
- Set out the works and control lines and levels.
- Supervise excavation, PCC and RCC, formwork, reinforcement, masonry, plaster and flooring to drawings and specifications.
- Check reinforcement against the bar bending schedule before every pour.
- Carry out and record quality tests such as slump and cube tests.
- Prepare quantity take-offs and measure completed work for subcontractor bills.
- Coordinate with the structural consultant and the PEB and MEP teams; report progress daily.

Requirements
- B.E./B.Tech or Diploma in Civil Engineering.
- Experience on building construction sites.
- Able to read structural and architectural drawings.
- Working knowledge of IS 456:2000 (Plain and Reinforced Concrete - Code of Practice).
- AutoCAD and MS Excel; willing to work at project sites across India.',
  '["Civil execution","RCC","BBS","Quantity surveying","Billing","Quality control","AutoCAD"]'::jsonb,
  'civil-engineer', current_date
where not exists (select 1 from hr.jobs where website_slug = 'civil-engineer');

insert into hr.jobs (title, dept, location, type, exp, jd, skills, website_slug, posted_date)
select 'Safety Engineer', 'General', 'Noida', 'Full-time', '',
'Safety Engineer (EHS) - Construction & Fit-out Sites
Location: Noida, with postings to project sites across India

Responsibilities
- Prepare and run the site safety plan for each project.
- Induct every worker and hold regular toolbox talks.
- Operate the permit-to-work system for work at height, hot work and electrical isolation.
- Inspect scaffolding, ladders, edge protection, PPE and temporary electrical installations; get defects closed.
- Carry out hazard identification and risk assessment (HIRA) and job safety analysis for site activities.
- Report and investigate incidents and near misses; keep safety records and monthly reports.
- Coordinate with the client''s safety team and attend site safety reviews.

Requirements
- B.E./B.Tech or Diploma in engineering, plus a recognised safety qualification such as a Diploma in Industrial Safety or the NEBOSH International General Certificate.
- Safety experience on construction or fit-out sites.
- Familiarity with the Building and Other Construction Workers (Regulation of Employment and Conditions of Service) Act, 1996.
- Willing to be posted to project sites across India.',
  '["Construction safety","Permit to work","HIRA","Toolbox talks","Incident investigation","Safety audits"]'::jsonb,
  'safety-engineer', current_date
where not exists (select 1 from hr.jobs where website_slug = 'safety-engineer');

-- ── 4. Private bucket for website CVs ───────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-resumes', 'candidate-resumes', false, 5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- HireFlow users may read (and so createSignedUrl). Nobody else gets a
-- policy: the edge function writes on the service-role key, which bypasses
-- storage RLS. Deliberately no anon or public policy.
drop policy if exists hr_candidate_resumes_read on storage.objects;
create policy hr_candidate_resumes_read on storage.objects
  for select to authenticated
  using (bucket_id = 'candidate-resumes' and (select hr.has_hireflow()));

-- HR may delete a CV (e.g. a candidate asks for their data to be removed).
drop policy if exists hr_candidate_resumes_delete on storage.objects;
create policy hr_candidate_resumes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'candidate-resumes' and (select hr.has_hireflow()));

-- RLS on hr.applicants / hr.jobs is untouched. Do not add an anon policy.
