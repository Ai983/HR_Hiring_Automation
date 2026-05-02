-- HireFlow Phase 2 Schema Migration
-- Run in Supabase Dashboard → SQL Editor after schema.sql

-- ── 1. Patch existing applicants table ──────────────────────────────────────

-- Widen stage CHECK to include new pipeline stages
ALTER TABLE public.applicants DROP CONSTRAINT IF EXISTS applicants_stage_check;
ALTER TABLE public.applicants ADD CONSTRAINT applicants_stage_check
  CHECK (stage IN ('new','screening','calling','interview','reference','offer','hired','onboarding','rejected'));

-- Widen portal CHECK to include inbound channels
ALTER TABLE public.applicants DROP CONSTRAINT IF EXISTS applicants_portal_check;
ALTER TABLE public.applicants ADD CONSTRAINT applicants_portal_check
  CHECK (portal IN ('linkedin','indeed','jobhai','apna','facebook','instagram','email','whatsapp','manual'));

-- ── 2. Patch existing jobs table ────────────────────────────────────────────
-- Add Facebook / Instagram columns to portal_status default (JSONB — just update default)
ALTER TABLE public.jobs ALTER COLUMN portal_status SET DEFAULT '{
  "linkedin":  {"status":"draft","applicants":0,"views":0},
  "indeed":    {"status":"draft","applicants":0,"views":0},
  "jobhai":    {"status":"draft","applicants":0,"views":0},
  "apna":      {"status":"draft","applicants":0,"views":0},
  "facebook":  {"status":"draft","applicants":0,"views":0},
  "instagram": {"status":"draft","applicants":0,"views":0}
}'::jsonb;

-- ── 3. call_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id  uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  called_by     text NOT NULL,
  call_date     timestamptz DEFAULT now(),
  call_status   text NOT NULL CHECK (call_status IN (
    'connected','not_picked','callback_requested','rejected_on_call','moved_to_interview'
  )),
  call_notes    text,
  callback_time timestamptz,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_logs_applicant ON public.call_logs(applicant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status    ON public.call_logs(call_status);

-- ── 4. interviews ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id     uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  interview_type   text CHECK (interview_type IN ('hr','technical','director','final')),
  scheduled_at     timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  mode             text CHECK (mode IN ('in_person','google_meet','phone')),
  meet_link        text,
  panel            text[],
  venue            text,
  status           text DEFAULT 'scheduled' CHECK (status IN (
    'scheduled','completed','cancelled','rescheduled','no_show'
  )),
  feedback         jsonb,
  outcome          text CHECK (outcome IN ('pass','fail','hold')),
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interviews_applicant ON public.interviews(applicant_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status    ON public.interviews(status);

-- ── 5. references ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.references (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id       uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  referee_name       text NOT NULL,
  referee_designation text,
  referee_company    text,
  referee_phone      text,
  referee_email      text,
  relationship       text,
  reference_status   text DEFAULT 'pending' CHECK (reference_status IN (
    'pending','contacted','completed','unreachable'
  )),
  feedback_rating    int CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_notes     text,
  checked_by         text,
  checked_at         timestamptz,
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_references_applicant ON public.references(applicant_id);

-- ── 6. offers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.offers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id      uuid NOT NULL REFERENCES public.applicants(id),
  job_id            uuid REFERENCES public.jobs(id),
  ctc_gross_annual  numeric NOT NULL,
  ctc_breakup       jsonb,
  joining_date      date,
  probation_months  int DEFAULT 6,
  offer_letter_url  text,
  esign_status      text DEFAULT 'draft' CHECK (esign_status IN ('draft','sent','signed','declined')),
  offer_status      text DEFAULT 'pending' CHECK (offer_status IN (
    'pending','accepted','negotiating','declined','withdrawn'
  )),
  negotiation_notes text,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offers_applicant ON public.offers(applicant_id);
CREATE INDEX IF NOT EXISTS idx_offers_status    ON public.offers(offer_status);

-- ── 7. joinings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.joinings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id             uuid NOT NULL REFERENCES public.applicants(id),
  offer_id                 uuid REFERENCES public.offers(id),
  employee_id              text,
  joining_date             date NOT NULL,
  joining_location         text,
  joining_type             text CHECK (joining_type IN ('hq','site')),
  reporting_manager_email  text,
  status                   text DEFAULT 'pre_joining' CHECK (status IN (
    'pre_joining','doc_pending','doc_submitted','day1_ready',
    'joined','induction_done','probation_active','confirmed'
  )),
  it_request_sent          boolean DEFAULT false,
  finance_setup_done       boolean DEFAULT false,
  kra_set                  boolean DEFAULT false,
  attendance_enrolled      boolean DEFAULT false,
  induction_done           boolean DEFAULT false,
  probation_end_date       date,
  probation_reminder_sent  boolean DEFAULT false,
  created_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_joinings_applicant ON public.joinings(applicant_id);
CREATE INDEX IF NOT EXISTS idx_joinings_status    ON public.joinings(status);

-- ── 8. documents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  joining_id         uuid NOT NULL REFERENCES public.joinings(id) ON DELETE CASCADE,
  doc_type           text NOT NULL CHECK (doc_type IN (
    'aadhaar','pan','salary_slip_1','salary_slip_2','salary_slip_3',
    'previous_offer_letter','experience_letter','education_10th',
    'education_12th','education_graduation','education_postgrad',
    'bank_passbook','cancelled_cheque','photo','passport'
  )),
  file_path          text,
  file_url           text,
  status             text DEFAULT 'pending' CHECK (status IN (
    'pending','submitted','verified','rejected','not_applicable'
  )),
  verification_notes text,
  verified_by        text,
  verified_at        timestamptz,
  submitted_at       timestamptz,
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_joining ON public.documents(joining_id);
CREATE INDEX IF NOT EXISTS idx_documents_status  ON public.documents(status);

-- ── 9. RLS on new tables ─────────────────────────────────────────────────────
ALTER TABLE public.call_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.joinings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on call_logs"  ON public.call_logs  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on interviews" ON public.interviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on references" ON public.references FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on offers"     ON public.offers     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on joinings"   ON public.joinings   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on documents"  ON public.documents  FOR ALL USING (true) WITH CHECK (true);
