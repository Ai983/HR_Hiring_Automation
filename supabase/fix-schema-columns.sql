-- HireFlow: Add any missing columns so the app and Edge Functions work
-- Run in Supabase Dashboard → SQL Editor (after jobs, applicants, questionnaires exist)
-- Safe: only adds columns that are missing; does not drop data.

-- jobs: app expects title, dept, location, type, exp, salary, jd, jd_linkedin, jd_indeed, jd_jobhai, jd_apna, skills (jsonb), portal_status (jsonb), posted_date
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'dept') THEN
    ALTER TABLE public.jobs ADD COLUMN dept text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'portal_status') THEN
    ALTER TABLE public.jobs ADD COLUMN portal_status jsonb DEFAULT '{"linkedin":{"status":"draft","applicants":0,"views":0},"indeed":{"status":"draft","applicants":0,"views":0},"jobhai":{"status":"draft","applicants":0,"views":0},"apna":{"status":"draft","applicants":0,"views":0}}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'posted_date') THEN
    ALTER TABLE public.jobs ADD COLUMN posted_date date DEFAULT current_date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'skills') THEN
    ALTER TABLE public.jobs ADD COLUMN skills jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'jd_linkedin') THEN
    ALTER TABLE public.jobs ADD COLUMN jd_linkedin text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'jd_indeed') THEN
    ALTER TABLE public.jobs ADD COLUMN jd_indeed text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'jd_jobhai') THEN
    ALTER TABLE public.jobs ADD COLUMN jd_jobhai text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'jd_apna') THEN
    ALTER TABLE public.jobs ADD COLUMN jd_apna text;
  END IF;
END $$;

-- applicants: app expects applied_at (and stage, resume_path, etc.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'applicants' AND column_name = 'applied_at') THEN
    ALTER TABLE public.applicants ADD COLUMN applied_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'applicants' AND column_name = 'resume_path') THEN
    ALTER TABLE public.applicants ADD COLUMN resume_path text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'applicants' AND column_name = 'resume_text') THEN
    ALTER TABLE public.applicants ADD COLUMN resume_text text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'applicants' AND column_name = 'screening_notes') THEN
    ALTER TABLE public.applicants ADD COLUMN screening_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'applicants' AND column_name = 'shortlisted') THEN
    ALTER TABLE public.applicants ADD COLUMN shortlisted boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'applicants' AND column_name = 'ai_score') THEN
    ALTER TABLE public.applicants ADD COLUMN ai_score int;
  END IF;
END $$;

-- questionnaires: Edge Function expects custom_topics, sections (jsonb)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'questionnaires' AND column_name = 'custom_topics') THEN
    ALTER TABLE public.questionnaires ADD COLUMN custom_topics text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'questionnaires' AND column_name = 'sections') THEN
    ALTER TABLE public.questionnaires ADD COLUMN sections jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Optional: copy data if you had different column names (uncomment if needed)
-- UPDATE public.jobs SET dept = "desc" WHERE dept IS NULL AND "desc" IS NOT NULL;  -- if you had "desc" instead of dept
-- UPDATE public.jobs SET portal_status = jsonb_build_object('linkedin', jsonb_build_object('status', COALESCE(status,'draft'), 'applicants', 0, 'views', 0), ...) WHERE portal_status IS NULL;  -- only if you had a "status" column
