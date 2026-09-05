-- =====================================================================
-- Performance management — basic version  ·  5 Sep 2026
-- ---------------------------------------------------------------------
-- There was nothing here before: no table, no panel, no data. This is the
-- smallest model that is actually usable rather than a stub — a review
-- CYCLE, and one REVIEW per employee per cycle carrying a self assessment,
-- a manager assessment and a final rating.
--
-- WHAT IS DELIBERATELY NOT HERE
-- No KRA/goal weighting tables, no 360 feedback, no calibration, no
-- promotion or increment workflow, no notification schedule. Hagerstone's
-- appraisal process has not been specified to us, and inventing five tables
-- of it would mean HR working around a process we made up. `goals` is free
-- text for now precisely so it does not pretend to a structure nobody has
-- agreed. When the real process is written down, extend this — the cycle /
-- review split survives almost any appraisal design.
--
-- RATINGS ARE 1–5 WITH ONE DECIMAL
-- numeric(2,1), constrained 1.0–5.0. Half points ("3.5") are how people
-- actually rate, and an integer column forces a conversation about rounding
-- at exactly the wrong moment. NULL means "not rated yet" — never 0, which
-- would read as the worst possible score in every average.
--
-- WHO CAN DO WHAT
--   cycles  — read: every authenticated user (an employee needs the cycle
--             name to make sense of their own review). write: is_hr_admin().
--   reviews — read: your OWN review, or anything if is_hr_admin().
--             write: is_hr_admin() only.
-- An employee reading their own appraisal is the point of putting it on a
-- portal. An employee reading a colleague's is a serious incident, so the
-- select policy is scoped by hr.my_employee_id() rather than left open.
-- =====================================================================

-- ── 1. Review cycles ────────────────────────────────────────────────────
create table if not exists hr.performance_cycles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  period_start date not null,
  period_end   date not null,
  status       text not null default 'draft',
  notes        text,
  created_by   uuid references public.employees(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint performance_cycles_status_check
    check (status = any (array['draft','active','closed'])),
  constraint performance_cycles_period_check
    check (period_end >= period_start),
  constraint performance_cycles_name_uniq unique (name),
  constraint performance_cycles_name_check check (length(btrim(name)) > 0)
);

comment on table hr.performance_cycles is
  'An appraisal period, e.g. "H1 2026". draft = being set up, active = reviews in progress, closed = final.';

-- ── 2. Reviews ──────────────────────────────────────────────────────────
create table if not exists hr.performance_reviews (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references hr.performance_cycles(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,

  -- What was agreed for the period. Free text on purpose — see the header.
  goals text,

  -- Self assessment
  self_rating       numeric(2,1),
  self_comments     text,
  self_submitted_at timestamptz,

  -- Manager assessment. manager_id is who reviewed, which is not necessarily
  -- whoever happened to be logged in when the row was saved.
  manager_id           uuid references public.employees(id) on delete set null,
  manager_rating       numeric(2,1),
  manager_comments     text,
  manager_submitted_at timestamptz,

  -- Outcome
  final_rating numeric(2,1),
  status       text not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint performance_reviews_status_check
    check (status = any (array['draft','self_review','manager_review','final'])),
  constraint performance_reviews_self_rating_check
    check (self_rating is null or (self_rating >= 1 and self_rating <= 5)),
  constraint performance_reviews_manager_rating_check
    check (manager_rating is null or (manager_rating >= 1 and manager_rating <= 5)),
  constraint performance_reviews_final_rating_check
    check (final_rating is null or (final_rating >= 1 and final_rating <= 5)),

  -- One review per person per cycle. Without this a double-click on "Add
  -- everyone" silently creates two reviews for the same employee and the
  -- cycle average is quietly wrong.
  constraint performance_reviews_cycle_employee_uniq unique (cycle_id, employee_id)
);

comment on column hr.performance_reviews.final_rating is
  'The agreed outcome. NULL = not concluded. Never defaults from the manager rating — a final rating is a decision someone makes, not an arithmetic result.';

create index if not exists performance_reviews_cycle_idx    on hr.performance_reviews (cycle_id);
create index if not exists performance_reviews_employee_idx on hr.performance_reviews (employee_id);

drop trigger if exists performance_cycles_touch_updated_at on hr.performance_cycles;
create trigger performance_cycles_touch_updated_at
  before update on hr.performance_cycles
  for each row execute function hr.touch_updated_at();

drop trigger if exists performance_reviews_touch_updated_at on hr.performance_reviews;
create trigger performance_reviews_touch_updated_at
  before update on hr.performance_reviews
  for each row execute function hr.touch_updated_at();

-- ── 3. RLS ──────────────────────────────────────────────────────────────
-- Helper calls wrapped in (select …) per CLAUDE.md hard rule 2.
alter table hr.performance_cycles  enable row level security;
alter table hr.performance_reviews enable row level security;

drop policy if exists performance_cycles_read_all on hr.performance_cycles;
create policy performance_cycles_read_all on hr.performance_cycles
  for select to authenticated
  using (true);

drop policy if exists performance_cycles_write_hr_admin on hr.performance_cycles;
create policy performance_cycles_write_hr_admin on hr.performance_cycles
  for all to authenticated
  using ((select hr.is_hr_admin()))
  with check ((select hr.is_hr_admin()));

-- Your own review, or everything if you are HR. Note the ordering: the
-- cheap equality is first so the helper is not evaluated for rows that
-- already matched.
drop policy if exists performance_reviews_read_own_or_hr on hr.performance_reviews;
create policy performance_reviews_read_own_or_hr on hr.performance_reviews
  for select to authenticated
  using (employee_id = (select hr.my_employee_id()) or (select hr.is_hr_admin()));

drop policy if exists performance_reviews_write_hr_admin on hr.performance_reviews;
create policy performance_reviews_write_hr_admin on hr.performance_reviews
  for all to authenticated
  using ((select hr.is_hr_admin()))
  with check ((select hr.is_hr_admin()));

revoke all on hr.performance_cycles  from anon;
revoke all on hr.performance_reviews from anon;
grant select, insert, update, delete on hr.performance_cycles  to authenticated;
grant select, insert, update, delete on hr.performance_reviews to authenticated;
