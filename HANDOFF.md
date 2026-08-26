# HireFlow — Attendance / Location / SSO Handoff

_Last updated: 2026-08-26_

Scope of this document: everything built **after the SEPL `HRMS.md` was shared** — the
attendance + location + universal-login foundation. **Most of `HRMS.md` (payroll, full
roster, performance, etc.) is NOT built yet** — see [Not started](#5-not-started).

> ### ⚠️ Read this first — state as of 2026-07-30
>
> Three things a new dev will trip over immediately:
>
> 1. **The OpenAI account is out of quota** (`insufficient_quota`). Every AI feature —
>    resume screening, JD enhancement, call prep, questionnaire, interview summary,
>    reference summary, offer-letter text — returns a 502 with the provider's message.
>    The code is fine; the account needs topping up.
> 2. **RLS is now ON across the whole `hr` schema.** It used to be off on 11 tables and
>    anon could read *and write* candidate PII. If a query suddenly returns 0 rows,
>    check you are using the right key/role before assuming a bug.
>    See `supabase/rls-hardening-golive.sql`.
> 3. **The attendance module replaced a Google Sheet and carries 18,492 migrated rows.**
>    10,622 of those punches are attached to an HR-only roster, not to hub employees,
>    because 28 names were ambiguous. That mapping is still pending — see
>    [Pending decisions](#4-in-the-middle--pending-decisions).

---
## ★ 2026-08-26 — Attendance regularization, drive-form → hub, M1/M2 status

Three things landed this session. A and B are shipped; C is a live-ops bug the team must still close.

### A. Attendance regularization (governed per-day corrections) — SHIPPED
`hr.attendance_day` is a computed view, so a past day cannot be edited directly. Added a
precedence-override the view honours, gated to a designated authority, fully audited.

- **Migration:** `supabase/migrations/PENDING_hr_attendance_regularization.sql` — **applied to the hub via the SQL editor on 2026-08-26** (the `PENDING_` name is historical; it is live). Adds:
  - `hr.attendance_regularization` — one override row per subject+day (`new_status`, optional `in_at`/`out_at`, **mandatory `reason`**, `regularized_by`+email, `prev_status`, timestamps; `unique(subject_id, work_date)`).
  - `hr.is_attendance_regularizer()` — authority gate. **Attendance authority = HR (`hr.admin@hagerstone.com`)**, deliberately separate from leave approval, which stays with the EA (`hr.is_leave_approver()` = `ea@`).
  - `hr.regularize_attendance(subject, date, status, reason, in_at?, out_at?, prev?)` RPC — re-checks the gate + a **self-exclusion rule** (`subject_id <> hr.my_employee_id()`) + mandatory reason, then upserts.
  - `attendance_day` rebuilt to LEFT JOIN the override with top precedence (status / in / out / worked_minutes / day_credit), emitting corrected days even inside the coverage gap. Still `security_invoker`; `attendance_month` counts from it so corrections roll up automatically.
- **UI:** Sidebar → Employee Management → **Attendance Fix** (`src/components/panels/AttendanceRegularize.jsx`) — visible only to the regularizer (hidden from EA), form applies via the RPC, list shows every correction (who/when/why). Client gate `isAttendanceRegularizer` / `ATTENDANCE_REGULARIZER_EMAILS` in `src/leaveConfig.js`; service `regularizeAttendance` / `fetchRegularizations` in `src/services/attendanceService.js`.
- **Prerequisite (confirmed 2026-08-26):** `hr.admin@hagerstone.com` is an active `public.employees` row with a linked `auth_user_id`.
- **Do not weaken:** the self-exclusion guard is deliberate — nobody edits their own attendance/pay. If HR's own day needs a fix, add a *second* email to `hr.is_attendance_regularizer()` and have that person do it. Do not add a self-edit path.

### B. Drive Google Form → hub `hr.survey_responses` — SHIPPED (n8n)
The walk-in Google Form's response sheet (`1Z_DtrVdHE…`, "Form Responses 1") previously only fired WhatsApp confirmations; its rows never reached the DB. New active n8n workflow **`WF-0 Drive Form → Survey Leads (Hub)`** (`NiLJ49i2KCp6g2qg`): Sheets `rowAdded` → map → dedupe by phone (`meta_lead_id = gform:<phone>`) → insert `hr.survey_responses` (`source=direct`, `platform=google_form`, `status=new`). No WhatsApp (WF-1 sends M1). 21 existing applicants backfilled. Surfaces in **Survey Leads**; a `direct`→"Walk-in" badge was added to `SURVEY_SOURCES` (`src/constants.js`).

### C. ⚠ M1/M2 drive messaging is BROKEN — team must close
- **WF-1 M1** (`7ll0RwAy6AihidFC`): `Normalise Phone` used `require('crypto')`, now blocked by the n8n task-runner → every run errored since ~18 Aug. **Fixed + republished 2026-08-26** (plain-string dedupe). Only ~4 earliest registrants ever got M1.
- **WF-5 sweeper + reply poller** (`If7EXWOG4LvHo3l2`) and **WF-2 M2** (`9d9tNypTVgDQcZgQ`): crons carry **month `7` (July)** not `8` — `0 */30 * 18-22 7 *`, `0 30 5 20 7 *` — so the M1 safety-net sweep, the YES/NO reply poll, and the M2 attendance-confirm batch **never fired in August**. **NOT fixed.** The team must decide whether to send now (real WhatsApps to ~21–23 candidates) and, if so, change the cron month to `8`. The M2 eligibility filter is fine (verified 23/23 eligible).

## 0. Location-verified attendance + Hub integration (2026-08-01)

Built after the 07-30 handoff. Ties attendance to real GPS, sources sites from CPS,
and surfaces everything in the Hub founder dashboard. **DB + edge fn are already
applied/deployed to the live hub; only the two front-ends still need deploying.**

### What changed
- **Sites now come from CPS.** `public.projects` (CPS projects + offices, with
  `site_address`) are synced into `hr.sites` (59 rows, each with `code`/`address`/
  `source`). Re-run anytime with `node sync-cps-sites.mjs --write`. New columns on
  `hr.sites`: `address, project_code, source, geocode_confidence, geocode_provider,
  geocoded_at` (migration `03-site-geocode.sql`).
- **Coordinates are ground-truth, not guessed.** Auto-geocoding messy addresses was
  unreliable, so a site's pin comes from: (1) admin map-pick / “use my location”
  (→ `verified`), (2) auto-calibration from the first precise punch (→ `approx`),
  (3) a “locate from address” assist. **Blocking only ever fires on a `verified`
  pin** — `approx`/unset sites are cross-checked and flagged, never blocked. No
  false lockouts.
- **Punch enforcement** (`attendance-punch`, redeployed): the employee picks a site;
  their GPS must match it. A precise fix clearly outside a verified site's radius is
  **rejected (400)**; weak GPS / unverified site / no coords → recorded + flagged.
  Fixed a latent NaN bug that wrongly blocked good fixes when sites had null coords.
- **Calibration workflow.** Attendance Setup → **Calibrate** tab: per-site punch
  cluster (count, median centre, spread, suggested radius) → one-click **Set&Verify**
  turns blocking on. RPC `hr.site_calibration()` (admin-gated). Phased rollout:
  assign home sites → collect punches → verify → enforce.
- **Home site** per employee (`hr.employee_profile.home_site_id`), set in HR Settings;
  pre-selects their site on the punch screen.
- **Time-on-site + out-of-site** for admins: Location Tracking gained **Site Time**
  (dwell from check-in→check-out, RPC `hr.site_dwell`, admin-or-self gated) and
  **Out of Site** tabs; Team Map rings now come from `hr.sites`.
- **Single-login (SSO).** The Hub tile hands its Supabase session to this app via a
  URL fragment; the portal adopts it (`consumeSsoHandoff` in `authService.js`) — no
  second login. Required `detectSessionInURL:false` on the client (the `#sso=` hash
  was deadlocking the auth lock). Hub side: `ModuleCard` appends the session for
  modules flagged `sso:true` (attendance, hireflow).
- **Hub founder dashboard** (`Hagerstone-Hub` repo): new `AttendanceSection` — today's
  present/late/absent/on-leave/on-site, off-site punches, team last-known positions.
  Backed by `public.hr_attendance_overview()` (admin/founder-gated, returns null else).

### Migrations added (already applied to live hub)
`03-site-geocode.sql`, `04-site-dwell.sql`, `05-home-site-calibration.sql`,
`06-attendance-overview.sql` (all in `supabase/hub-migration/`, idempotent).

### Still to deploy (front-ends only — checkpoint)
1. **HireFlow** (this repo) → `hr-hiring-automation.vercel.app` (portal + admin).
2. **Hagerstone-Hub** → its Vercel app (SSO tile hand-off + founder AttendanceSection).
   Local clone with the changes is at `../Hagerstone-Hub`; push to `Ai983/Hagerstone-Hub`.

### Go-live step (do together)
Set **Head Office**'s pin: Attendance Setup → Sites → Head Office → drop pin / “use my
location” at the office → Save (→ `verified`). Blocking is then live for HO. Other
active sites self-calibrate from first punches; verify them in the Calibrate tab.

---

## 1. Context & architecture

- **Two backends:**
  - **App repo** — this React (Vite) app: HireFlow hiring + Employee Management (attendance/location/leave).
  - **Hub Supabase project** — `tpfvnerrjhqwipyonngf`. All app tables live in the **`hr` schema**.
- **Employee identity is shared, not owned here:**
  - `public.employees` = company master (74 rows). Read-mostly; **not** created/edited by HireFlow.
  - `hr.employees` = **read-only** view over the master (security-definer, so lists work for any caller).
  - `hr.employee_profile` = HireFlow-owned HR fields (1:1 with master): `pin` (legacy), `track_location`, `roster`.
- **Maps/location stack is fully free** (decision): browser GPS (`navigator.geolocation`),
  Nominatim reverse-geocode, Leaflet/OSM tiles, haversine geofence. **No Google Maps API.**

### SSO / access model (already existed in the hub)
- **Login** = Supabase Auth **email + password** = the universal Hagerstone Hub credential.
- **Modules**: `hireflow` (hiring area) and `attendance` (workforce/attendance area) — plus
  `cps`, `finance_*`, `lcs`, etc. for other hub apps.
- **Access** = `public.roles.default_modules` ∪ `public.employee_module_access` grants − revokes.
  Every role includes `attendance`; `hireflow` is limited to admin/ai/founder/hr/management/mis.
- **RLS**: `employees_read_own` (self), `employees_admin_read_all` (`is_admin()`), `module_access_read_own`.

---

## 2. What was built (in order)

### A. Employee write model
- HR fields now write to `hr.employee_profile` via upsert (the `employees` view is read-only).
  Service: `setEmployeePin`, `setTrackLocation`, `setEmployeeRoster` in `src/services/attendanceService.js`.
- `EmployeeManagement.jsx` rewritten: lists the 74 master employees (identity read-only),
  manages **PIN + location tracking** via an "HR Settings" modal. Add/Deactivate removed.

### B. Universal Hagerstone Hub login (SSO)
- **`hr.my_context()`** RPC (SECURITY DEFINER) → `{ employee_id, employee_code, name, email, role,
  track_location, modules[] }` for the logged-in user, with grant/revoke overrides.
- `src/services/authService.js` — `signIn`, `signOut`, `getSession`, `onAuthChange`, `fetchContext`.
- `src/components/auth/Login.jsx` — email/password screen (admin app).
- `src/context/AppContext.jsx` — session/context/modules; gates data loading on auth.
  **Note:** resolve() is deferred out of the `onAuthStateChange` callback to avoid a Supabase
  auth-lock deadlock (do not call `supabase.*` synchronously inside that callback).
- `src/App.jsx` — splash → login → access check → **module-gated panels** (hiring=`hireflow`,
  workforce=`attendance`).
- `src/components/layout/Sidebar.jsx` — groups gated by module; footer shows signed-in user +
  **Sign out**. The old "Clear all data (testing)" button was removed.
- **Attendance portal** (`attend.html` → `AttendancePortal.jsx`) — PIN login replaced with hub
  email/password, session auto-resume, **PIN-free punch**.
- `supabase/functions/attendance-punch` — rewritten to identify the employee from the **session
  JWT** (`auth.uid() → public.employees`), tracking flag from `hr.employee_profile`. No PIN.

### C. Team Map fix + notifications
- **Punch now drops a `location_tracking` point** (in `attendance-punch`), so check-ins appear on
  Live / Team Map / Timeline.
- `src/services/locationService.js` — `fetchLive` / `fetchLatest` no longer require
  `track_location=true`; timeline picker (`fetchTrackedEmployees`) includes anyone with a point.
- `supabase/functions/notify-attendance` (new) — admin/HR-gated WhatsApp broadcast via **MayTAPI**
  (product `b8cce1b9…`, phone `46821`). Guides employees to the portal + hub login. Supports
  `dry_run`, `test_phone`, and a subset via `employee_ids`. Secrets set on the hub:
  `MAYTAPI_PRODUCT_ID`, `MAYTAPI_PHONE_ID`, `MAYTAPI_TOKEN`.

---

### D. Full end-to-end test pass + 12 bug fixes (2026-07-30)

Ran ~110 assertions against the live hub with throwaway QA accounts (since deleted):
every service query, PostgREST embed, all 9 edge functions, storage, and anon probes.
Bugs found and fixed:

| # | Bug | Impact |
|---|-----|--------|
| 1 | Documents status cycle was `pending → not_applicable → pending` | `submitted`/`verified`/`rejected` unreachable — the whole verification feature was dead |
| 2 | `datetime-local` sent naive local time, Postgres read it as UTC | **every interview scheduled 5.5h off**; same for callback times. Fixed via `localInputToISO` |
| 3 | Quick-Add offered "No specific job" but `applicants.job_id` is NOT NULL | hard failure with a raw Postgres error |
| 4 | `checkDuplicate` existed but was never called | duplicate candidates unpreventable |
| 5 | `attendance-punch` had no duplicate guard | unlimited repeat punches; now a 409, IST-day aware |
| 6 | `fetchCallQueue` never selected `call_logs` | call history never rendered |
| 7 | Offers set stage `hired` on creation | inflated the Hired count before acceptance |
| 8 | `generate-questionnaire` swallowed its insert error in a `try/catch` that could never fire | questionnaires silently failed to save |
| 9 | `submitFeedback` wrote only the jsonb column, `synthesize-feedback` reads the flat ones | **AI scored every candidate "null/5"** |
| 10 | Resume phone regex needed 10 *consecutive* digits | `+91 98765 43210` yielded a blank phone — HR had no number to call |
| 11 | 4 AI functions read only `OPENAI_API_KEY` and indexed `choices[0]` unchecked | any provider error surfaced as `Cannot read properties of undefined` |
| 12 | Leave day columns were `numeric(4,1)` | **0.25-day short leaves silently rounded to 0.3** — 20% over-count, incl. 126 imported rows |

Also wired three edge functions that existed but nothing called: offer-letter
generation (now produces a real `.docx` — AI writes only the welcome paragraph,
every figure comes from `computeCtcBreakup`), interview panel summary, and
reference summary.

### E. Security hardening (2026-07-30) — `supabase/rls-hardening-golive.sql`

Verified with the anon key that ships in the browser bundle: candidate PII, offer CTC,
call notes and interview feedback were all readable, and `INSERT` into `hr.applicants`
**succeeded**. Separately, any logged-in employee could read every colleague's
attendance, read stored PINs, and file leave under someone else's ID.

- RLS enabled on all 15 `hr` tables; anon fully sealed (0 rows, `42501` on write).
- Hiring tables scoped to `hr.has_hireflow()`, which recomputes the hub's own module
  maths so it can never drift from `hr.my_context()`.
- attendance / location / leave / employee_profile scoped per-employee, with
  `hr.is_hr_admin()` for HR/admin.
- The three roll-up views were owner-rights views and **bypassed RLS entirely**; they
  now use `security_invoker = true`.

60/60 security assertions passed, tested as both an HR user and an ordinary
`site_engineer`.

### F. Attendance parity with the retired HSIPL Google Sheet (2026-07-30)

The punch screen was already better on identity and GPS, but the entire calculation
layer the month runs on did not exist. Full record in
`supabase/hr-attendance-hsipl-parity.sql`.

New in `hr`: `sites` (45), `attendance_person` (HR-only roster), `holidays`,
`attendance_settings` (shift 08:00–19:00, late 09:30, full day 9h, OT past 9h,
weekend days), `attendance_remarks`, plus views `attendance_subject`,
`attendance_day` (replaces BACKHAND + Monthly Attendance) and `attendance_month`
(replaces the Overtime Sheet).

New panels: **Weekly Report** (person × day grid), **Monthly Report** (month totals +
day-by-day drawer + remarks), **Attendance Setup** (sites / holidays / shift rules).
Portal regained the required site dropdown and the photo is now mandatory.

Migrated: 17,584 punches (2024-03-08 → 2026-07-30, photo links kept), 908 leave
records, 16 Sunday-workers, 45 sites, 10 holidays.

**Validated against the sheet's own computed report** — Shivani, July 2026, all nine
metrics identical: 25 working days, 24 on time, 1 late, SL 2, CL/EL/HD/SHL/UL 0.
Her hours tie out too (9:24am–6:31pm = 547 min), and the sheet's own OT flag on that
day confirms overtime starts past 9h.

---

## 3. Current state (verified working)

- Admin app: hub login → module-gated UI. Verified with temp users (attendance-only,
  hireflow, and a plain `site_engineer`).
- Attendance portal: hub login → site pick → photo → punch. Duplicate punches rejected
  with 409. GPS cross-checks the chosen site and flags mismatches but never blocks.
- Weekly / Monthly reports derive from the punches — changing the OT threshold from 9h
  to 10h in the UI moved Shivani's July OT from 172 min to 0 and back, proving the
  numbers are computed, not stored.
- Team Map returns punched locations.
- `notify-attendance`: dry-run verified — **53 recipients**, correct message. **Nothing sent.**
- Browser-layer tested where possible: real PDF and DOCX text extraction, 19/19 Indian
  phone formats, CSV comma escaping, geofence math, leave policy, datetime round-trip.
- Dev server runs on **http://localhost:5173/** (5174 if 5173 is taken by another hub app).

### Not verifiable from outside a browser
Camera selfie capture, `navigator.geolocation`, Leaflet rendering, kanban drag-and-drop
and CSV download all need a real browser with hardware permissions. The data paths
behind them are tested; the interactions are not.

---

## 4. In the middle / pending decisions

### Blocked on a business decision (not code)

- **🔴 OpenAI account out of quota.** All 6 AI features return 502. Top up billing at
  platform.openai.com; no code change needed. The functions accept either the
  `OPEN_API` or `OPENAI_API_KEY` secret.
- **28 ambiguous name mappings.** 10,622 imported punches sit on `hr.attendance_person`
  unlinked. Only exact name matches were linked, because a wrong link puts attendance on
  the wrong person's payroll. `Amit` (769 punches) could be Amit Choudhary or Amit Kumar
  Mishra; `Ritu` (701) could be Ritu Sharma or Ritu Ma'am; and the hub itself contains
  genuine duplicates — Avisha ×2, Mohit Sharma ×2, Mukul Tyagi ×2, Rohit Sharma ×2.
  To review, with my suggestion in `note`:
  ```sql
  select full_name, note from hr.attendance_person
  where employee_id is null order by full_name;
  ```
  To link one: `update hr.attendance_person set employee_id = '<uuid>' where id = '<uuid>';`
  The views pick it up immediately — nothing needs re-importing.
- **Site coordinates deliberately blank.** `hr.sites` has 45 sites and no lat/long. A
  guessed coordinate would falsely flag every genuine punch at that site as a GPS
  mismatch. Add them per site in Attendance Setup; verification switches on as you do.
- **SHL = 0.25 day is an inference**, from the Setting tab's `0.75` short-leave totals
  being 3 × SHL. Confirm; it's a one-line change in `src/leaveConfig.js`.
- **Notification blast NOT sent.** Needs a public portal URL and a go-ahead
  (test-to-one-number first, then ~52 staff). Trigger:
  `POST /functions/v1/notify-attendance` with `{ portal_url, dry_run?, test_phone? }` as
  an admin.
- **App not deployed publicly** — only localhost. Employees can't reach the portal yet.
- **n8n workflows are re-pointed but INACTIVE.** Activating them sends real WhatsApp
  messages to real candidates, so it is a deliberate step. See `n8n-workflows/SETUP.md`.

### Known small gaps

- **No "Notify employees" button** in the admin UI — only the edge function exists.
- **PIN is vestigial** — punching uses SSO. The PIN field in "HR Settings" does nothing.
  `hr.employees` still exposes the `pin` column to any authenticated user; the commented
  block at the bottom of `rls-hardening-golive.sql` drops it once the UI field goes.
- **Weekly/Monthly reports are read-only.** Correcting a punch is still done from the
  Attendance panel; there is no inline edit from the report.
- The old project `sgerslbmnwrltqrhsdir` had its service-role key committed in this repo
  in plaintext. It has been removed, but **treat that key as leaked** and delete the old
  project if it still holds candidate data.

---

## 5. Not started

Rest of SEPL `HRMS.md`: **payroll & salary structures, full shift management, performance**,
and related modules. The attendance / location / leave / employees / auth slice is done,
including the holiday calendar and overtime that the earlier version of this doc listed
as missing.

---

## 6. Run & verify

```bash
npm install
npm run dev          # http://localhost:5173/             (admin app)
                     # http://localhost:5173/attend.html  (employee portal)
```
Log in with any Hagerstone Hub email + password. Access follows the person's modules.

**Secrets** live in the local `.env` (gitignored) and as Supabase edge-function secrets.

**Deploying edge functions.** `npx supabase functions deploy <name> --project-ref
tpfvnerrjhqwipyonngf` needs `SUPABASE_ACCESS_TOKEN` or `supabase login`. Current
deployed versions: `attendance-punch` v8, `generate-questionnaire` v5,
`synthesize-feedback` v5, `generate-offer-letter` v5, `summarize-reference` v5,
`call-prep` v5.

**Sanity checks after any schema change:**
```sql
select * from hr.attendance_settings;                    -- shift / OT rules
select count(*) from hr.attendance where source='import'; -- 17584
select * from hr.attendance_month
 where month = date_trunc('month', current_date)::date;   -- this month's report
```

> **Rebuilding the schema.** The applied DDL is exported to
> `supabase/migrations/` (8 files, in order — see the README there). Apply those, then
> `supabase/rls-location.sql` and `supabase/rls-hardening-golive.sql` for the access
> model. All are idempotent.
>
> A fresh clone still will **not** have: `.env` (copy `.env.example`), the 18,492
> migrated attendance rows (live data, source export is gitignored — it contains
> employee PII), the edge-function secrets, or the storage buckets.
>
> `supabase/hr-attendance-hsipl-parity.sql` is prose, not DDL — it explains *why*
> the schema looks like it does. `supabase/migrations/` is what you actually run.

---

## 7. Security notes

- `env`, `.env`, `db-connections.json`, `db-*.json/mjs` are gitignored — **never commit secrets.**
- **RLS is ON across all 15 `hr` tables** (`supabase/rls-hardening-golive.sql`). anon gets
  nothing. Hiring tables require the `hireflow` module via `hr.has_hireflow()`;
  attendance/leave/location are self-scoped with `hr.is_hr_admin()` for HR and admin.
- **Views must use `security_invoker = true`.** `attendance_subject`, `attendance_day` and
  `attendance_month` originally did not, and silently bypassed RLS. If you add a view over
  an RLS-protected table, set this or you will leak the table.
- `hr.employees` remains a security-definer view, so any authenticated user can read the
  roster (names, emails, departments) through it — and currently the vestigial `pin`
  column too. Accepted for now; the fix is sketched at the end of the hardening SQL.
- Edge functions use the service-role key and therefore **bypass RLS by design**. Any new
  one must do its own authorisation — `attendance-punch` is the reference: it identifies
  the caller from the JWT and never trusts a client-supplied employee id.
- n8n hits the hub with the service-role key and needs `Accept-Profile: hr` /
  `Content-Profile: hr`, because the tables are not in `public`.

---

## 8. Reference documentation (system context)

These `.md`/`.sql` files carry the design context for the whole system and belong in git.

| File | What it is |
|------|------------|
| `hagerstone-hiring-automation-blueprint.md` | Original HireFlow blueprint — job posting → onboarding → document collection (the hiring product this repo started as). |
| `HRMS.md` | **SEPL/SOTYN.AI HRMS spec** — the reference HRMS (server + client + schema, file:line anchored). The target most of the remaining work maps to. |
| `LOCATION-TRACKING-SYSTEM.md` | Full SEPL location-tracking + geofenced-attendance system flow — the source spec for our location feature. |
| `LOCATION-TRACKING-HIREFLOW-PLAN.md` | Implementation plan that ported that system into **this** repo (React 18 + JSX + Supabase). Matches what was built. |
| `LOCATION-TRACKING-HUB-PLAN.md` | Parallel plan written for the Hagerstone Hub (React 19 + TS). Logic reference only — not this repo's file paths. |
| `n8n-workflows/SETUP.md` | The 8 hiring-automation n8n workflows (WhatsApp/MayTAPI) + import instructions. **Includes the 2026-07-30 hub re-point** and what each workflow still needs. |
| `supabase/rls-hardening-golive.sql` | **Applied.** The RLS model for the whole `hr` schema, with the evidence that prompted it and a rollback block. |
| `supabase/hr-attendance-hsipl-parity.sql` | **Applied.** Full record of the attendance rebuild: objects created, data migrated, the sheet's inconsistent date formats, and the validation against the sheet's own report. |
| `supabase/rls-location.sql` | Applied earlier — RLS for the 4 attendance/location tables. Superseded in part by the go-live hardening. |
| `supabase/migrations/` | **The runnable DDL**, exported from what was actually applied. `README.md` there gives the order and lists what a clone still won't have. |
| `DEPLOY-NOTES.md` | ⚠️ Deploy steps written for the **old** standalone project `sgerslbmnwrltqrhsdir` ("Hiring System"), **not** the current hub `tpfvnerrjhqwipyonngf`. Treat as historical. |
| `RUN-IN-SQL-EDITOR.sql` | ⚠️ One-off location schema for the **old** project `sgerslbmnwrltqrhsdir`. Superseded by `supabase/hub-migration/*.sql`. Historical. |
| `CLAUDE.md` | **Start here.** Short orientation for anyone picking the repo up — stack, the three Vite entry points, the hard rules, and the full engineering notes for the walk-in assessment system (built 19 Aug 2026). |
| `HAGERSTONE_DRIVE_AND_ASSESSMENT.md` | The 22 Aug 2026 mass interview drive: roles, funnel, the assessment paper and its scoring policy, and the open items still needing HR sign-off. |
| `HANDOFF.md` | This document. |

**Reading order for a new dev:** `CLAUDE.md` → `hagerstone-hiring-automation-blueprint.md` → `HANDOFF.md` (this) →
`supabase/rls-hardening-golive.sql` (how access works now) →
`supabase/hr-attendance-hsipl-parity.sql` (how attendance works now) →
`LOCATION-TRACKING-SYSTEM.md` → `LOCATION-TRACKING-HIREFLOW-PLAN.md` → `HRMS.md` (the road ahead).

---

## 9. Working rule for this repo

`public.employees` and every other module's schema (`cps`, `finance`, `lcs`, delegation,
gie) are **read-only from HireFlow**. They are shared with live apps. When the HSIPL sheet
brought in 40 people with no hub account, they went into `hr.attendance_person` rather
than the shared master — which is why `hr.attendance` and `hr.leave_requests` both carry a
nullable `employee_id` XOR `person_ref`.

Before and after any schema work, snapshot row counts of all non-`hr` tables and diff
them. The only delta should be `supabase_migrations`:

```sql
select string_agg(format('%s=%s', tbl, n), ' | ' order by tbl)
from (select c.relname tbl,
             (xpath('/row/c/text()', query_to_xml(
               format('select count(*) as c from %I.%I', n.nspname, c.relname),
               false, true, '')))[1]::text::bigint n
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind='r' and n.nspname not in
            ('pg_catalog','information_schema','hr') and n.nspname not like 'pg_%') s;
```
