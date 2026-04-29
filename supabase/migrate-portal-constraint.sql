-- HireFlow: Expand portal check constraint to include email, WhatsApp, Facebook, Instagram, and manual uploads
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Drop old constraint that only allowed linkedin/indeed/jobhai/apna
ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS applicants_portal_check;

-- Step 2: Add new constraint that covers all inbound channels
ALTER TABLE public.applicants
  ADD CONSTRAINT applicants_portal_check
  CHECK (portal IN (
    'linkedin',
    'indeed',
    'jobhai',
    'apna',
    'email',
    'whatsapp',
    'facebook',
    'instagram',
    'manual'
  ));

-- Verify (should return 0 rows if all existing values are valid)
SELECT portal, count(*) FROM public.applicants
  WHERE portal NOT IN ('linkedin','indeed','jobhai','apna','email','whatsapp','facebook','instagram','manual')
  GROUP BY portal;
