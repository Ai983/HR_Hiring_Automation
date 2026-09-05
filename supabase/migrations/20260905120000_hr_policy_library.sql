-- =====================================================================
-- HR policy library  ·  5 Sep 2026
-- ---------------------------------------------------------------------
-- HR uploads the policy documents the company already has (Company
-- Policy, Timings & Attendance, Leave Policy, ZTP) and every signed-in
-- employee can read them from the dashboard.
--
-- WHY A FILE, NOT RICH TEXT
-- These documents exist today as Word/PDF files someone already wrote and
-- had signed off. Retyping them into a rich-text editor would fork the
-- official copy from the portal copy on day one, and the portal copy would
-- be the one nobody trusts. So the row is metadata and the document itself
-- lives in storage.
--
-- WHY A PRIVATE BUCKET
-- `resumes` and `selfies` are public buckets — anyone with the URL reads
-- them, no login. A ZTP or leave policy is internal: it names disciplinary
-- process and entitlements, and a public URL is one forward away from being
-- outside the company. So `hr-policies` is private and the client signs a
-- short-lived URL per download, the same way `offer-letters` handles salary
-- (see offerService.signedOfferLetterUrl).
--
-- WHO CAN DO WHAT
--   read   — every authenticated user. That is the entire point: a policy
--            nobody can open is not published. Deliberately NOT gated on the
--            hireflow or attendance module; policies are company-wide.
--   write  — hr.is_hr_admin() (hr_admin + super_admin). Uploading is what
--            makes a document official, so it is not an ordinary employee's
--            action.
--
-- VERSIONING IS BY ROW, NOT BY OVERWRITE
-- A superseded policy is kept with is_active = false rather than deleted or
-- overwritten in place. "Which version was in force in March" is a question
-- that gets asked in exactly the disputes these documents exist to settle,
-- and an overwritten file cannot answer it.
-- =====================================================================

-- ── 1. The table ────────────────────────────────────────────────────────
create table if not exists hr.policies (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  title         text not null,
  description   text,

  -- Storage coordinates. file_path is the object key inside the
  -- `hr-policies` bucket; file_name is what the document was called when it
  -- was uploaded, so a download is not named after a uuid.
  file_path     text not null,
  file_name     text not null,
  file_size     bigint,
  mime_type     text,

  version       integer not null default 1,
  effective_from date,
  is_active     boolean not null default true,

  -- Denormalised uploader name on purpose: the FK goes to NULL when an
  -- employee leaves, and "uploaded by —" on a policy document is worse than
  -- a stale name. Same trade-off the attendance regularization table makes.
  uploaded_by      uuid references public.employees(id) on delete set null,
  uploaded_by_name text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint policies_category_check check (category = any (array[
    'company',             -- Company Policy
    'timings_attendance',  -- Timings, Attendance
    'leave',               -- Leave Policy
    'ztp',                 -- Zero Tolerance Policy
    'other'
  ])),
  constraint policies_version_check check (version >= 1),
  constraint policies_title_check   check (length(btrim(title)) > 0)
);

comment on table hr.policies is
  'Company policy documents. Row = metadata; the file lives in the private `hr-policies` storage bucket. Readable by every authenticated user, writable only by hr.is_hr_admin().';
comment on column hr.policies.is_active is
  'false = superseded. Superseded policies are KEPT, never deleted — "which version was in force in March" is asked in exactly the disputes these documents settle.';
comment on column hr.policies.file_path is
  'Object key inside the `hr-policies` bucket. Sign it on demand; never expose it directly.';

-- The panel lists one category at a time, newest first, active only.
create index if not exists policies_category_active_idx
  on hr.policies (category, is_active, created_at desc);

-- `updated_at` maintenance, reusing the existing trigger function.
drop trigger if exists policies_touch_updated_at on hr.policies;
create trigger policies_touch_updated_at
  before update on hr.policies
  for each row execute function hr.touch_updated_at();

-- ── 2. RLS ──────────────────────────────────────────────────────────────
-- Helper calls are wrapped in (select …) per CLAUDE.md hard rule 2 — a bare
-- call re-evaluates per row and has already cost this project an 8s
-- statement timeout once (20260819062423).
alter table hr.policies enable row level security;

drop policy if exists policies_read_all on hr.policies;
create policy policies_read_all on hr.policies
  for select to authenticated
  using (true);

drop policy if exists policies_write_hr_admin on hr.policies;
create policy policies_write_hr_admin on hr.policies
  for all to authenticated
  using ((select hr.is_hr_admin()))
  with check ((select hr.is_hr_admin()));

-- anon gets nothing. There is no public policy page and no edge function
-- for one; if a public handbook is ever wanted it goes through a
-- service-role function, not an anon policy here.
revoke all on hr.policies from anon;
grant select on hr.policies to authenticated;
grant insert, update, delete on hr.policies to authenticated;

-- ── 3. Storage bucket ───────────────────────────────────────────────────
-- PRIVATE. See the header. The client calls createSignedUrl per download.
insert into storage.buckets (id, name, public)
values ('hr-policies', 'hr-policies', false)
on conflict (id) do update set public = false;

-- This is a SHARED hub project — cps, lcs, delegation and expense all keep
-- objects in the same storage.objects table. Every policy below is scoped to
-- bucket_id = 'hr-policies' and must stay that way; an unscoped policy here
-- would hand our rules to another product's files.
drop policy if exists hr_policies_read   on storage.objects;
create policy hr_policies_read on storage.objects
  for select to authenticated
  using (bucket_id = 'hr-policies');

drop policy if exists hr_policies_insert on storage.objects;
create policy hr_policies_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hr-policies' and (select hr.is_hr_admin()));

drop policy if exists hr_policies_update on storage.objects;
create policy hr_policies_update on storage.objects
  for update to authenticated
  using (bucket_id = 'hr-policies' and (select hr.is_hr_admin()))
  with check (bucket_id = 'hr-policies' and (select hr.is_hr_admin()));

drop policy if exists hr_policies_delete on storage.objects;
create policy hr_policies_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'hr-policies' and (select hr.is_hr_admin()));
