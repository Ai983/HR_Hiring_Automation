-- ============================================================
-- HireFlow → Hub consolidation: dedicated `hr` schema in the company DB.
-- Isolated from public/cps/finance/... (house convention: one schema per system).
-- People bridge to the shared master public.employees via FK (master untouched).
-- Idempotent. Safe to re-run.
-- ============================================================

create schema if not exists hr;

-- ── ATS: jobs ────────────────────────────────────────────────
create table if not exists hr.jobs (
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
  portal_status jsonb default '{"apna": {"views": 0, "status": "draft", "applicants": 0}, "indeed": {"views": 0, "status": "draft", "applicants": 0}, "jobhai": {"views": 0, "status": "draft", "applicants": 0}, "facebook": {"views": 0, "status": "draft", "applicants": 0}, "linkedin": {"views": 0, "status": "draft", "applicants": 0}, "instagram": {"views": 0, "status": "draft", "applicants": 0}}'::jsonb,
  posted_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── ATS: applicants (+ drift cols current_ctc/expected_ctc for call-prep fn) ──
create table if not exists hr.applicants (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references hr.jobs(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  portal text not null,
  resume_path text,
  resume_text text,
  stage text not null default 'new',
  ai_score integer,
  shortlisted boolean default false,
  screening_notes text,
  current_ctc numeric,
  expected_ctc numeric,
  applied_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint applicants_portal_check check (portal = any (array['linkedin','indeed','jobhai','apna','facebook','instagram','email','whatsapp','manual'])),
  constraint applicants_stage_check check (stage = any (array['new','screening','calling','interview','reference','offer','hired','onboarding','rejected'])),
  constraint applicants_ai_score_check check (ai_score is null or (ai_score >= 0 and ai_score <= 100))
);

-- ── ATS: call_logs ───────────────────────────────────────────
create table if not exists hr.call_logs (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references hr.applicants(id) on delete cascade,
  called_by text not null,
  call_date timestamptz default now(),
  call_status text not null,
  call_notes text,
  callback_time timestamptz,
  created_at timestamptz default now(),
  constraint call_logs_status_check check (call_status = any (array['connected','not_picked','callback_requested','rejected_on_call','moved_to_interview']))
);

-- ── ATS: interviews (+ granular feedback_* cols for synthesize-feedback fn) ───
create table if not exists hr.interviews (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references hr.applicants(id) on delete cascade,
  interview_type text,
  scheduled_at timestamptz not null,
  duration_minutes integer default 60,
  mode text,
  meet_link text,
  panel text[],
  venue text,
  status text default 'scheduled',
  feedback jsonb,
  outcome text,
  feedback_technical integer,
  feedback_communication integer,
  feedback_culture_fit integer,
  feedback_recommendation text,
  feedback_notes text,
  created_at timestamptz default now(),
  constraint interviews_type_check check (interview_type = any (array['hr','technical','director','final'])),
  constraint interviews_mode_check check (mode = any (array['in_person','google_meet','phone'])),
  constraint interviews_status_check check (status = any (array['scheduled','completed','cancelled','rescheduled','no_show'])),
  constraint interviews_outcome_check check (outcome is null or outcome = any (array['pass','fail','hold']))
);

-- ── ATS: offers ──────────────────────────────────────────────
create table if not exists hr.offers (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references hr.applicants(id) on delete cascade,
  job_id uuid references hr.jobs(id),
  ctc_gross_annual numeric not null,
  ctc_breakup jsonb,
  joining_date date,
  probation_months integer default 6,
  offer_letter_url text,
  esign_status text default 'draft',
  offer_status text default 'pending',
  negotiation_notes text,
  created_at timestamptz default now(),
  constraint offers_esign_check check (esign_status = any (array['draft','sent','signed','declined'])),
  constraint offers_status_check check (offer_status = any (array['pending','accepted','negotiating','declined','withdrawn']))
);

-- ── ATS: joinings ────────────────────────────────────────────
create table if not exists hr.joinings (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references hr.applicants(id) on delete cascade,
  offer_id uuid references hr.offers(id),
  employee_id text,
  joining_date date not null,
  joining_location text,
  joining_type text,
  reporting_manager_email text,
  status text default 'pre_joining',
  it_request_sent boolean default false,
  finance_setup_done boolean default false,
  kra_set boolean default false,
  attendance_enrolled boolean default false,
  induction_done boolean default false,
  probation_end_date date,
  probation_reminder_sent boolean default false,
  created_at timestamptz default now(),
  constraint joinings_type_check check (joining_type is null or joining_type = any (array['hq','site'])),
  constraint joinings_status_check check (status = any (array['pre_joining','doc_pending','doc_submitted','day1_ready','joined','induction_done','probation_active','confirmed']))
);

-- ── ATS: documents ───────────────────────────────────────────
create table if not exists hr.documents (
  id uuid primary key default gen_random_uuid(),
  joining_id uuid not null references hr.joinings(id) on delete cascade,
  doc_type text not null,
  file_path text,
  file_url text,
  status text default 'pending',
  verification_notes text,
  verified_by text,
  verified_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  constraint documents_type_check check (doc_type = any (array['aadhaar','pan','salary_slip_1','salary_slip_2','salary_slip_3','previous_offer_letter','experience_letter','education_10th','education_12th','education_graduation','education_postgrad','bank_passbook','cancelled_cheque','photo','passport'])),
  constraint documents_status_check check (status = any (array['pending','submitted','verified','rejected','not_applicable']))
);

-- ── ATS: references (reserved word — quoted) ──────────────────
create table if not exists hr."references" (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references hr.applicants(id) on delete cascade,
  referee_name text not null,
  referee_designation text,
  referee_company text,
  referee_phone text,
  referee_email text,
  relationship text,
  reference_status text default 'pending',
  feedback_rating integer,
  feedback_notes text,
  checked_by text,
  checked_at timestamptz,
  created_at timestamptz default now(),
  constraint references_status_check check (reference_status = any (array['pending','contacted','completed','unreachable'])),
  constraint references_rating_check check (feedback_rating is null or (feedback_rating >= 1 and feedback_rating <= 5))
);

-- ── ATS: questionnaires ──────────────────────────────────────
create table if not exists hr.questionnaires (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references hr.jobs(id) on delete cascade,
  interview_type text not null,
  custom_topics text,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  constraint questionnaires_type_check check (interview_type = any (array['hr','director']))
);

-- ── ATS: survey_responses (Meta/Apna leads + AI analysis) ────
create table if not exists hr.survey_responses (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'facebook',
  platform text,
  form_name text,
  campaign_name text,
  ad_name text,
  meta_lead_id text,
  full_name text,
  email text,
  phone text,
  current_city text,
  age_range text,
  answers jsonb not null default '{}'::jsonb,
  ai_score integer,
  ai_recommendation text,
  ai_one_line text,
  ai_strengths jsonb,
  ai_concerns jsonb,
  ai_call_priority text,
  ai_suggested_question text,
  ai_salary_fit text,
  ai_analyzed_at timestamptz,
  status text default 'new',
  whatsapp_sent boolean default false,
  applicant_id uuid,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  constraint survey_source_check check (source = any (array['facebook','instagram','apna','linkedin','direct'])),
  constraint survey_reco_check check (ai_recommendation is null or ai_recommendation = any (array['strong_recommend','recommend','borderline','reject'])),
  constraint survey_score_check check (ai_score is null or (ai_score >= 0 and ai_score <= 100)),
  constraint survey_priority_check check (ai_call_priority is null or ai_call_priority = any (array['high','medium','low'])),
  constraint survey_status_check check (status = any (array['new','ai_pending','reviewed','called','converted','rejected','duplicate']))
);

-- ============================================================
-- WORKFORCE — bridge to shared master public.employees(id).
-- Created now (empty) so HireFlow can operate on the REAL 74 employees.
-- ============================================================

-- HR-specific per-employee extension (1:1 with public.employees).
create table if not exists hr.employee_profile (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  pin text,
  track_location boolean not null default false,
  roster text not null default 'general',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists hr.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null,
  recorded_at timestamptz not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  accuracy double precision,
  address text,
  site_id text,
  site_name text,
  location_verified boolean default true,
  selfie_url text,
  status text default 'present',
  admin_notes text,
  created_at timestamptz default now(),
  constraint attendance_type_check check (type = any (array['check_in','check_out'])),
  constraint attendance_status_check check (status = any (array['present','late','absent','half_day','on_leave']))
);
create index if not exists idx_hr_att_emp_time on hr.attendance(employee_id, recorded_at desc);

create table if not exists hr.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_to text not null,
  leave_type text not null,
  reason text,
  start_date date not null,
  end_date date not null,
  total_days numeric(4,1) not null default 0,
  paid_days numeric(4,1) default 0,
  unpaid_days numeric(4,1) default 0,
  status text default 'pending',
  admin_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  constraint leave_type_check check (leave_type = any (array['casual','half_day','emergency','sick'])),
  constraint leave_status_check check (status = any (array['pending','approved','rejected','cancelled']))
);
create index if not exists idx_hr_leave_emp on hr.leave_requests(employee_id, start_date desc);

create table if not exists hr.geofence_settings (
  id uuid primary key default gen_random_uuid(),
  site_id text,
  site_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 200,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists hr.location_tracking (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  captured_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  address text,
  site_name text
);
create index if not exists idx_hr_loc_emp_time on hr.location_tracking(employee_id, captured_at desc);
