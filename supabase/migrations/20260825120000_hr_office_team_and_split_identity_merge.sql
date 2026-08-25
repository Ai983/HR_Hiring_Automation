-- ============================================================================
-- hr_office_team_and_split_identity_merge
--
-- Groundwork for the EA's "Office Team" attendance report. Three separate
-- things, all of which have to land before the HSIPL coverage-gap rows are
-- imported (scripts/import-hsipl-gap.mjs) and before the blackout is retired
-- (20260825130000).
--
--   1. The late cut-off becomes 09:30.
--   2. Eight split identities are merged.
--   3. hr.employee_profile.office_team marks who the EA report covers.
--
-- Idempotent. Uses text + named checks, no enums, per the house style.
--
-- ── 1. WHY 09:30 ───────────────────────────────────────────────────────────
-- late_after has been 09:45 in production since the settings row was created,
-- but every attendance report Hagerstone has ever printed — the HSIPL sheet's
-- Overtime Sheet and the per-person month sheets taken off it — treated 09:30
-- as the cut-off. 09:45 was never the company rule; it was a default nobody
-- revisited. The two disagree for every person on every day: for one employee
-- in July 2026 it is the difference between 19 On Time / 5 Late (the printed
-- record) and 22 / 2 (this system).
--
-- hr.attendance_day is a view, so this re-scores ALL history the moment it is
-- applied — every month, every person, backwards and forwards. That is the
-- intent: one rule, one number, no era where the system and the paper
-- disagree. Confirmed by the EA on 2026-08-25.
--
-- ── 2. WHY THE MERGE, AND WHY THIS ORDER ───────────────────────────────────
-- The original HSIPL import matched sheet names to hub employees where it
-- could and parked the rest on hr.attendance_person roster rows. Eight people
-- ended up on BOTH sides of that line: their pre-August history went to a
-- roster row, and when the portal went live on 2026-08-12 their real punches
-- went to their employees row. One person, two subjects, neither complete —
-- Avisha's 719 historic punches sit apart from the 21 she has made since.
--
-- The repointing MUST happen before hr.attendance_person.employee_id is set.
-- hr.attendance_subject drops a roster row the instant it is linked ("once
-- linked, the employee row represents them"), so setting the link first would
-- leave 2,817 punches pointing at a person_ref that no longer resolves to any
-- subject, and they would silently vanish from attendance_day, attendance_month
-- and every report built on them.
--
-- Two names in the sheet resolve to nobody at all (Kanhaiya kumar, Samad khan)
-- and get roster rows here so the import has somewhere to put them.
--
-- NOT DONE HERE: HAG-032 (procurement@hagerstone.com) is a duplicate of
-- HAG-010 — same person, two active employee records. public.employees is
-- read-only from this repo (CLAUDE.md rule 1), so retiring it needs someone
-- with hub access. Until then she is one person with two rows, only one of
-- which carries any attendance.
--
-- ── 3. WHY A FLAG AND NOT A DERIVED LIST ───────────────────────────────────
-- "The office team" could be derived — anyone with a portal punch — but that
-- silently drops a person the moment they are away for a fortnight, and the
-- EA asked for two people (Yash Kumar Sharma, Bipin Jha) who have not punched
-- on the portal at all yet. A stored flag is explicit, survives absence, and
-- the EA can edit it from the panel.
-- ============================================================================

-- ── 1. The late cut-off the printed reports actually used ───────────────────
update hr.attendance_settings
   set late_after = '09:30', updated_at = now()
 where id;

-- ── 2a. Sheet names that exist nowhere in the system yet ────────────────────
insert into hr.attendance_person (full_name, note)
select v.full_name, 'Created 2026-08-25 by the HSIPL coverage-gap import; punches in the sheet, no hub account.'
  from (values ('Kanhaiya kumar'), ('Samad khan')) as v(full_name)
 where not exists (
   select 1 from hr.attendance_person p where p.full_name = v.full_name);

-- ── 2b. Merge the eight split identities ────────────────────────────────────
-- Roster name -> hub employee, by email: employee_code is null for several
-- people so it cannot be the key. Signed off by the EA on 2026-08-25.
do $$
declare
  m record;
  emp uuid;
  per uuid;
  moved int;
begin
  for m in
    select * from (values
      ('Ajit Singh',         'ajitreddy916@gmail.com'),         -- HAG-004
      ('Avisha',             'avijennet2001@gmail.com'),        -- HAG-010
      ('Fardeen',            'fardeenkhan77556556@gmail.com'),  -- HAG-020
      ('Ritu',               'ritudesaiwal@gmail.com'),         -- HAG-037 Ritu Ma'am, NOT HAG-018
      ('Saksham',            'sakshamkaloya109@gmail.com'),     -- Saksham Verma, no code
      ('Sapna Rahi',         'sapnarahi12@gmail.com'),          -- HAG-042
      ('Vipin',              'vipinjha7011@gmail.com'),         -- HAG-051, spelt "Bipin" in the hub
      ('Yogesh Kumar Singh', 'ys11c60@gmail.com')               -- HAG-054
    ) as t(roster_name, email)
  loop
    select id into emp from employees where lower(email) = lower(m.email) and is_active;
    select id into per from hr.attendance_person where full_name = m.roster_name;

    -- Refuse rather than half-merge. A missing target here means the hub
    -- record was renamed or retired, and guessing would weld two people.
    if emp is null then
      raise exception 'merge target not found for roster "%": %', m.roster_name, m.email;
    end if;
    continue when per is null;   -- already merged and the row was cleaned up

    -- Order is load-bearing: repoint every child row FIRST (see the header).
    update hr.attendance       set employee_id = emp, person_ref = null where person_ref = per;
    get diagnostics moved = row_count;
    update hr.leave_requests   set employee_id = emp, person_ref = null where person_ref = per;
    update hr.attendance_remarks set employee_id = emp, person_ref = null where person_ref = per;

    -- Only now is it safe to link, which removes the roster row from
    -- hr.attendance_subject. Kept rather than deleted so the old sheet name
    -- stays traceable to the person it became.
    update hr.attendance_person
       set employee_id = emp,
           note = coalesce(note || ' | ', '')
                  || 'Merged into ' || m.email || ' on 2026-08-25.'
     where id = per;

    raise notice 'merged roster "%" -> % (% punches)', m.roster_name, m.email, moved;
  end loop;
end $$;

-- ── 3. The office-team flag ─────────────────────────────────────────────────
alter table hr.employee_profile
  add column if not exists office_team boolean not null default false;

comment on column hr.employee_profile.office_team is
  'Included in the EA''s Office Team attendance report. Explicit rather than derived from recent punches, so someone away for a fortnight does not silently drop off the report.';

insert into hr.employee_profile (employee_id, office_team)
select e.id, true
  from employees e
 where lower(e.email) in (
   'aj1893372@gmail.com',            -- HAG-003 Abhishek Jha
   'ajitreddy916@gmail.com',         -- HAG-004 Ajit
   'aniketawasthi.work@gmail.com',   --         Aniket
   'avijennet2001@gmail.com',        -- HAG-010 Avisha
   'carrers@hagerstone.com',         -- HAG-011 Shivani
   'fardeenkhan77556556@gmail.com',  -- HAG-020 Fardeen Khan
   'ritudesaiwal@gmail.com',         -- HAG-037 Ritu Ma'am
   'sakshamkaloya109@gmail.com',     --         Saksham Verma
   'sapnarahi12@gmail.com',          -- HAG-042 Sapna k rahi
   'skushal274@gmail.com',           -- HAG-048 Kushal Singh
   'vipinjha7011@gmail.com',         -- HAG-051 Bipin (Vipin) Jha
   'ys11c60@gmail.com',              -- HAG-054 Yogesh Singh
   'yyashkumar8@gmail.com',          -- HAG-056 Yash kumar Sharma
   'dba88795@gmail.com',             -- HAG-071 Deepak Bansal
   'prashanterkumar7010@gmail.com'   -- HAG-076 Prashant Kumar
 )
    on conflict (employee_id) do update set office_team = true, updated_at = now();

-- ── 4. Expose the flag on hr.attendance_subject ─────────────────────────────
-- Appended last so `create or replace view` accepts it. Roster people are
-- never office team: the report is for people who punch on the portal, and a
-- roster person has no hub login to punch with.
create or replace view hr.attendance_subject as
  select e.id                                     as subject_id,
         'employee'::text                         as subject_kind,
         e.id                                     as employee_id,
         null::uuid                               as person_ref,
         e.full_name,
         e.employee_code,
         e.department,
         coalesce(p.planned_days_per_week, 6)     as planned_days_per_week,
         coalesce(p.works_sunday, false)          as works_sunday,
         coalesce(p.allowed_leaves_per_month, 2.5) as allowed_leaves_per_month,
         e.is_active,
         coalesce(p.office_team, false)           as office_team
  from hr.employees e
  left join hr.employee_profile p on p.employee_id = e.id
  union all
  select ap.id, 'roster', null::uuid, ap.id, ap.full_name, null, null,
         ap.planned_days_per_week, ap.works_sunday, 0::numeric, ap.active, false
  from hr.attendance_person ap
  where ap.employee_id is null;

alter view hr.attendance_subject set (security_invoker = true);
grant select on hr.attendance_subject to authenticated;
