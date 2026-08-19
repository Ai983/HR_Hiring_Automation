# Applied migrations — hub project `tpfvnerrjhqwipyonngf`

These are the **actual DDL statements applied to production** on 2026-07-30, exported
from `supabase_migrations.schema_migrations`. They rebuild the attendance module's schema
from nothing.

Everything here is confined to the **`hr` schema**. `public.employees` and the other
modules' schemas (`cps`, `finance`, `lcs`, delegation, gie) are read-only from HireFlow —
they are shared with live apps.

## Order

| # | File | What it does |
|---|------|--------------|
| 1 | `20260730060404_hr_attendance_parity_with_hsipl_sheet.sql` | `sites`, `attendance_person`, `holidays`, `attendance_settings`, `attendance_remarks`; extends `attendance` (site_ref, person_ref, source, site_match, site_distance_m, photo_url, nullable employee_id + XOR check) and `employee_profile`; adds the SHL/UL leave codes; RLS + policies |
| 2 | `20260730061401_hr_attendance_day_and_month_rollups.sql` | `attendance_subject`, `attendance_day`, `attendance_month` views — replaces the sheet's BACKHAND / Monthly Attendance / Overtime Sheet tabs |
| 3 | `20260730061617_hr_leave_roster_support_and_source.sql` | leave for roster people: `person_ref`, `source`, nullable `employee_id`/`request_to`, XOR check |
| 4 | `20260730061848_hr_attendance_day_with_date_spine.sql` | rebuilds `attendance_day` over a date spine so absences, week-offs, holidays and leave days appear even with no punch |
| 5 | `20260730061955_hr_attendance_day_include_future_approved_leave.sql` | extends the spine to cover approved leave running past today, without marking future days absent |
| 6 | `20260730072038_hr_rollup_views_security_invoker.sql` | **security fix** — the three views were owner-rights and bypassed RLS entirely |
| 7 | `20260730084436_hr_leave_days_two_decimals_for_short_leave.sql` | **data fix** — day columns were `numeric(4,1)`, silently rounding 0.25-day short leaves to 0.3 |
| 8 | `20260730090000_hr_attendance_seed_reference_data.sql` | the 45 sites and 10 holidays (applied as plain SQL originally, captured here for reproducibility) |
| 9 | `20260814074535_attendance_coverage_gap_blackout.sql` | **data fix** — adds `coverage_gap_from/to` and rebuilds `attendance_day` to drop punch-less, leave-less days inside the import→go-live gap, which were being scored `absent` |
| 10 | `20260818093922_hr_leave_approval_ea_only.sql` | `is_leave_approver()` — only EA may write a leave decision; every HR/admin role keeps read access |
| 11 | `20260819062423_hr_rls_helper_calls_as_initplan.sql` | **performance fix** — policy helper calls were bare, so Postgres re-ran them per row and "My Attendance" hit the 8s `statement_timeout`. Wraps them in `(select …)`; 2390ms → 5ms. Access model unchanged |
| 12 | `20260819120000_hr_walkin_assessment_attempts.sql` | `assessment_attempts` — the walk-in test (§7 of `HAGERSTONE_DRIVE_AND_ASSESSMENT.md`). Applied 2026-08-19. **No `anon` policy and no `anon` grant** — candidates are anonymous and reach the table only through the service-role `assessment` edge function |

`9` is the current definition of `hr.attendance_day` and supersedes `4` and `5`.
It was applied to production on 2026-08-14 but only captured into this repo on
2026-08-19, so anything built from files 1-8 alone will be behind production.

Then apply the access model, which is a separate concern and predates these:

```
../rls-location.sql            # the 4 attendance/location tables (applied earlier)
../rls-hardening-golive.sql    # the full hr access model — 27 statements, runnable
```

`10` re-creates most of what `rls-hardening-golive.sql` defines, so it must be applied
**after** that file, not before. Applying the hardening script again would undo it.

## Not in this repo

| Missing | Why / where it is |
|---|---|
| `.env` | Gitignored. Needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `MAYTAPI_*`. Copy `.env.example` and fill from the Supabase dashboard. `src/env.generated.js` regenerates itself from it on `npm run dev`. |
| The 18,492 migrated attendance rows | Live data, imported once from the HSIPL sheet. Not reproducible from this repo — the source export is gitignored because it contains employee PII and photo links. |
| Edge-function secrets | Set on the project (`OPEN_API`/`OPENAI_API_KEY`, `MAYTAPI_PRODUCT_ID`, `MAYTAPI_PHONE_ID`, `MAYTAPI_TOKEN`). |
| Storage buckets | `resumes`, `selfies` (public) and `offer-letters` (private, scoped to `hr.has_hireflow()`) were created through the dashboard/API. |

## Re-running

All eight are idempotent — `create table if not exists`, `create or replace view`,
`add column if not exists`, guarded `do $$` blocks for constraints, and
`on conflict do nothing` for the seed. Re-running is safe.

## After applying, sanity-check

```sql
select * from hr.attendance_settings;          -- 08:00-19:00, late 09:30, OT past 540m
select count(*) from hr.sites;                 -- 45
select count(*) from hr.holidays;              -- 10

-- views must be security_invoker, or they leak the underlying tables
select c.relname,
       (select option_value from pg_options_to_table(c.reloptions)
        where option_name = 'security_invoker') as security_invoker
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'hr' and c.relkind = 'v';

-- and RLS must be on everywhere
select relname, relrowsecurity from pg_class
where relnamespace = 'hr'::regnamespace and relkind = 'r'
order by relrowsecurity, relname;
```
