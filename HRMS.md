# HRMS — Handoff (SOTYN.AI / SEPL ERP)

Verified read of the code (server + client + schema). Every claim carries a
`file:line` or table anchor. Where something could not be confirmed it is marked
**[unverified]**. Nothing here is assumed.

- **Stack:** Node/Express + `better-sqlite3` (raw SQL, no ORM) · React 19 + Vite + Tailwind.
- **Who it's for / who designed it:** built for **Secured Engineers Pvt Ltd (SEPL)**;
  requirements come from the owner referred to in-code as **"mam" (Monika)** — the
  code is dense with dated `mam (2026-0x-xx)` design comments that are the spec of record.
- **Schema:** one big `initializeDatabase()` in `server/db/schema.js` (CREATE block +
  idempotent ALTER-migration array). A few modules self-create their tables inside
  their route file instead (noted per subsystem).

Sidebar **HRMS** group (`Layout.jsx:142-161`) → pages:
Hiring `/hr` · Sub-contractor Hiring `/subcon-hiring` · Onboarding `/induction` ·
Training `/training` · Attendance `/attendance` · Payroll `/payroll` · Employees
`/employees` · Performance `/scorecard` · Champions League `/champions` · Module
Owners `/module-owners` · Sub-contractor Master `/sub-contractors`.

> The **July-2026 payroll/attendance/roster changes** (this engagement) are documented
> separately in `docs/PAYROLL-ATTENDANCE-CHANGES-2026-07.md`; this file describes the
> whole subsystem as it now stands.

---

## 1. Employee register  (`/employees`, module `employees`)

**Tables**
- `employees` — `schema.js:1064-1076` (+ALTERs `2996-3019`, roster added this engagement):
  `id, user_id→users(id), name, phone, email, designation, department, join_date,
  salary, status CHECK(active|training|inactive|terminated)`; ALTER cols:
  `aadhar_file, pan_file, qualification_file` (mandatory docs on create),
  `salary_exempt` (full-salary employees), `cl_eligible`, `ot_eligible` (default 0),
  `cl_opening_balance`, `roster` (default `general`).

**How it works** (`server/routes/hr.js`)
- `GET /hr/employees` (`701`) lists `employees LEFT JOIN users`; salary redacted unless the caller has an HR role (`canSeeSalary` `690-699`).
- `POST /hr/employees` (`745`) requires the 3 ID docs; auto-links `user_id` by email.
- `PUT /hr/employees/:id` (`804`) also **syncs the linked login's `users.active`** to the employee's on-roll status (`826-848`, audit-logged).
- `GET /hr/roster-audit` (`718`) reconciles **tracked vs non-tracked**: `backlog` = active login linked to an inactive/terminated employee; `guests` = active login with no active employee row.
- **The `employees.user_id = users.id` link is the backbone** — attendance, payroll and "tracked" strength all key off it.

**Flaws:** `candidates`/`employees` list queries are unindexed on the filtered columns; `POST` only enforces docs, not other fields.

---

## 2. Attendance  (`/attendance`, module `attendance`)  — `server/routes/attendance.js`

**Tables:** `attendance` (`schema.js:1495-1516` +ALTERs) — one row per `user_id`+`date`:
`punch_in_time/out_time` (UTC ISO), lat/lng/address/photo (in & out), `site_name`,
`total_hours`, `status CHECK(present|half_day|short_day|absent|late|leave|holiday)`,
`remarks`, `admin_marked`, `marked_by`, `marked_at`, `proof_url`, `location_verified`,
`auto_punched_in/out`. Config in single-row `payroll_settings` (`1573`); also
`geofence_settings` (`1518`), `location_tracking` (`1541`), `leave_requests` (`1553`).

**Self service**
- **Punch in/out** (`/punch-in` `722`, `/punch-out` `776`): GPS mandatory, checked against site geofences via `lib/geofence.js` (uncertainty-honest — a weak indoor fix never blocks, only a confident off-site lock does). Late = punch after the (roster-aware) cutoff via `isPunchLate` (`25`).
- **Self views:** `/my-today` (`54`), `/my-month?month=` (`66`, calendar), `/my-history` (`244`) — all hide admin-marked allow-list rows from the employee's own view.
- **Live GPS trail:** `/track-location` (`830`) writes `location_tracking` every ~30s (feeds the admin Location page — see `SOLAR-EXEC-ADMIN.md`); `/track/:userId/:date` (`861`) reads a day's pings.

**Admin marking — 3 write paths, all `admin_marked=1`, none overwrites a real punch**
- **Mark / Backfill modal** (`/admin-mark` `364`): one user + one past date; the deliberate backfill action (has a proof file input).
- **Monthly grid one-click cycle** (`/grid` `590`; client `Attendance.jsx onCellClick`): full employee×day matrix. Clicking a cell shows a **detail panel** (date/status/In/Out/hours) and cycles status `present → absent → half_day → leave → clear` (real punches / approved leaves are read-only, detail only). Cell tags (`440-453`): `P` present/late · `H` half/short · `L` leave · `A` absent · `WO` Sunday/week-off · `WOP` worked-on-week-off (Sunday punch).
- **"P all" bulk** (`/admin-mark-bulk` `672`; client `markAllPresent`): fills every blank working day in the month present — **proof file mandatory** (uploads via `/upload`, passes `proof_url`).
- **Muster export:** `/grid/export.xlsx` (`601`) — printable P/A/WO/WOP/H/L sheet + present/half/leave/late totals in HR's raw format.
- **Proof gate (SEPL 2026-07, `admin-mark` `397-400`):** claiming a person **worked** (`present|half_day|short_day`) on a **past** day with **no `proof_url` → HTTP 400**; same-day "forgot to punch" stays frictionless. Keeps back-dated worked marks non-anonymous. **⚠ Collides with the grid quick-cycle — see H13.**

**Leave management** (`leave_requests`)
- **Apply** `POST /leave` (`1059`): casual/sick/short_leave etc.; **short-leave capped at 4h/month** (`1077`). Fires `leave.requested` email.
- **View** `GET /leaves` (`1104`): approvers/admin see all; plain users see only their own (scope keys off `attendance.can_approve`).
- **Decide** `PUT /leave/:id/approve` (`1129`, needs `attendance.approve`) → fires `leave.decided`; **edit** `PUT /leave/:id` (`1150`), **delete** `DELETE /leave/:id` (`1163`). Approved leaves flow into payroll (paid/unpaid split) and the grid.

**Geofence admin:** `geofence_settings` CRUD (`GET 871` open, `POST/PUT/DELETE 1016/1025/1033` permission-gated); `/audit/geofence-violations?days=` (`892`, admin / see-all only) surfaces off-site punches.

**Cross-cutting:** "today" is derived in **IST** everywhere via `istTodayStr()` (VPS runs UTC — L4 fix, this engagement). Auto punch-in/out cron is **disabled** (commented `setInterval`, `1236-1240`); a lazy allow-list auto-mark (`users.auto_mark_present`, `syncAutoMarkPresent` `282`) runs off the admin dashboard, no cron.

**Design intent:** manual + selfie only; geofence must never falsely block on-site staff; IST cutoff (VPS runs UTC).

**Flaws:** week-off = Sunday only (not configurable); `/report` legacy hardcoded end-day (pre-existing); **grid one-click cycle collides with the proof gate (H13)**.

---

## 3. Payroll  (`/payroll`, module `payroll`)  — `server/routes/payroll.js`

**Tables**
- `payroll_settings` (single row id=1, `schema.js:1573`): `late_after_time` (09:46), `half_day_after_time` (10:00), `min_hours_full_day` (8), `late_grace_count` (3), `late_per_minute_rate` (20), `lates_to_absent` (N lates → 1 absent), `working_days_per_month` (26), `sundays_paid`, CL/SL/PL allowances, `ot_threshold_hours` (9), `ot_rate_multiplier` (1), salary-component %s (basic/conveyance/hra/adhoc/misc).
- `payroll_runs` (`1604`, the monthly **snapshot/lock** table, UNIQUE(month,employee_id)): base_salary, day counts, `late_penalty`, `ot_hours`, `ot_pay`, `net_pay`, `breakdown_json`, `status CHECK(draft|finalised|disbursed)`, `finalised_by/at`, `paid/paid_at/paid_by`, and (this engagement) `ot_eligible, ot_per_hour_rate, ot_threshold, net_before_ot, roster` frozen at finalise.
- `payroll_advances` (`1635`): per-month advance + food + manual overrides.

**How it works — the engine `calculateForEmployee` (`107-576`)**
- Live-recompute per month: walk each day, classify from attendance (present/late/half/absent), Sundays, approved leaves; apply late penalty (grace-then-per-minute); add **OT separately** only if `employee.ot_eligible && day hours > ot_threshold`.
- **Late tracking (PR #12):** each late punch beyond the grace count adds a per-minute rupee penalty; **and** every `lates_to_absent` late marks convert to **1 unpaid absent day** (`lates_converted_absent`, `384-388`) — a stacked deterrent on top of the penalty.
- Returns split fields: `gross_earned, ot_hours, ot_pay, ot_per_hour_rate, net_before_ot, net_pay`.
- `salary_exempt` employees short-circuit to full salary (`128-170`).
- **Lock**: `POST /finalise` (`~640`) snapshots into `payroll_runs`; `PUT /paid/:id` marks disbursed; `POST /unlock` reopens. OT-eligibility is toggled on the **Leaves & Balances** screen (`PUT /leave-balance/:id`).
- **This engagement added:** re-finalise guard, unlock-blocked-after-paid + audit, OT-context snapshot, roster-aware cutoffs, and the bifurcated CSV export (`client/src/pages/Payroll.jsx`).

**Flaws (pre-existing, mostly fixed this engagement):** the old `/unlock` guard was dead; snapshot didn't freeze OT eligibility — both addressed. Export is client-side CSV (`utils/exportCsv.js`).

---

## 4. Roster / Shift  (this engagement)  — `server/lib/roster.js`
Two rosters (`general` 9:30 / `early` 9:00) assigned per employee (`employees.roster`).
`rosterCutoffs(settings, roster)` shifts the global late/half cutoffs (early −30 min).
Consumed by payroll late logic, punch-time `isPunchLate`, and `/my-month`. Frozen into
`payroll_runs` at finalise. UI dropdown in the Employees form. **Limitation:** one roster
per employee — a true mid-month split needs per-day tagging (deferred).

---

## 5. Hiring / ATS  (`/hr`, module `hr`)  — ⚠ TWO parallel systems

> **Major architectural finding:** recruitment ships as **two complete, non-integrated
> ATS stacks** at once. They share no tables, use different stage enums, different offer-token schemes.

**5a. ACTIVE system** (sidebar "Hiring") — `server/routes/hr.js` + `candidates` table + `publicHr.js`.
- `candidates` (`schema.js:794-805` +ALTERs `2962-2977`): `source CHECK(facebook|naukri|linkedin|reference|other)`, `status CHECK(lead|called|qualified|interview_scheduled|interview_done|offer_sent|accepted|onboarded|rejected)`, interview/md-interview fields, `offer_token/offer_accepted_at/offer_declined_at`.
- **State machine** (`hr.js:473-637`): `lead` → schedule-interview → `interview_scheduled` → interview-done → `qualified`/`rejected` → schedule-md-interview → md-decision → `offer_sent` (auto-generates offer + 256-bit `offer_token`) → public accept/decline → `accepted`/`rejected` → finalize → `onboarded`. (`called` is in the enum but never set — dead value.)
- **Public offer acceptance** (`publicHr.js`, mounted before auth): `GET/POST /api/public/offer/:token` — single-use (timestamp guards); **deliberately exposes offered salary + breakup** to the token holder (by design, `publicHr.js:14-18`).
- Also owns: resume upload+parse (`/candidates/parse-resume` → `utils/resumeParser.js`, pdf-parse/mammoth), screening Q&A + auto-reject rules engine (`screening_questions`), pre-onboarding `candidate_docs`, `interview_scorecards`, `hiring_requests`, `jd_templates`/`job_descriptions`, `candidate_events` timeline.

**5b. PARALLEL "HR System" MVP** (`/hr-system`, module `hr_system`) — `server/routes/hrSystem.js` + `hr_candidates` (self-created tables `46-235`).
- Stage enum `applied|screening|interview|final_round|selected|rejected|on_hold|offered|joined`; offer `accept_token` = 16-byte hex.
- Correctly gated by `requirePermission('hr_system', …)` on every route. Its `/offers/accept/:token` is labelled "public" but sits **behind auth → broken as a public link** (dead).

---

## 6. Onboarding / Induction  (`/induction`)  — `hr.js`
- `induction_items` (`schema.js:899-914`): `section` (founder/culture/hr_policies/it_security/sop), `content_type CHECK(text|video|pdf|link)`, content/order/active. CRUD `hr.js:2283-2337`.
- **Seed** `seed_induction_items_v1` (`schema.js:5263-5385`) — 5 starter items.
- Pre-onboarding checklist = the `candidate_docs` flow (auto-seeds standard docs per candidate). Parallel `hr_onboarding_tasks` table exists but **has no routes (dead)**.

## 7. Training  (`/training`)  — `hr.js`
- `training_videos` (`916-931`, `training_type CHECK`, target_dept/role, is_mandatory) + `training_assignments` (`934-948`, UNIQUE(employee,video), started/completed). CRUD + assign/mine/start/complete `hr.js:2340-2476`. No seed. Parallel `hr_training_*` tables are **dead**.

## 8. Final-round / Screening question banks  — `hr.js`
- `final_round_questions` (`1032-1049`, category/for_role/difficulty) — CRUD + random-pick; **seed of 25 Qs** (`schema.js:5395-5439`).
- `screening_questions`/`screening_answers` (`996+`) with an auto-reject rule engine (gt/lt/eq/contains/…).

---

## 9. Performance / MIS Scorecard  (`/scorecard`, module `scoring`)  — `server/routes/scoring.js`

**Tables** (`schema.js:1648-1728`): `score_templates`, `score_kpis` (weightage, direction
higher/lower_better, data_source `manual`|`auto:*`, default_planned), `score_user_template`
(one template/user), `score_user_kpi_target` (per-user planned/enabled/weight_override),
`score_entries` (weekly), `score_commitments`, `module_owners`.

**The engine — `computeScorecard` (`262-1015`)**, single source of truth:
- Per user × Mon–Sat week, per KPI resolve Planned (weekly entry → user target → default), Actual (manual entry or `auto:*` source), then **achievement %**:
  - higher_better: `actual/planned*100`; lower_better: `actual<=planned ? 100 : planned/actual*100`; floored at 0.
- **Final score = Σ(weightᵢ · pctᵢ) / Σ(weightᵢ)** (`~L1002`) — weighted mean of achievement %, 100 = exactly on plan.
- ~90 **auto data-sources** (`computeAutoCount` `316-960`) pull live counts from every module (delegations, DPR profit, indents, collections, attendance, RACI, live KPI-card metrics, …). Plan = tasks assigned this week, Actual = same cohort reaching done this week (so Actual ≤ Plan).
- Seeded by `seedScoring.js` (20 role templates) + KPI-card seed passes v1/v2/v3/v6/v7 in `schema.js`.

**RACI engine** (`raci.js` + `utils/raciModules.js`): per-record R/A/C/I + SLA across 13 modules; `record_id=0` = whole-module default owner. Feeds `auto:raci_*` KPIs. `GET /performance` = cross-module QQTC (Quantity/Time/Quality avg).

**Module Owners** (`/module-owners`): assigns each RACI module's owner (whole-module Responsible), scored on that module's plan-vs-actual.

## 10. Champions League / Gamification  (`/champions`, module `gamification`)  — `server/routes/champions.js`
- Self-created `gam_team`, `gam_team_member` (one team/user); dead Phase-3 tables `gam_kudos/gam_bonus/gam_award`.
- **Champions score for a week = that week's `computeScorecard().score` clamped 0..200**; a week qualifies only if it has a template, weight>0 and `activity ≥ min_activity`.
- **Period (month/quarter/year) score = simple average of qualifying weekly scores.** Leaderboard ranks qualified users desc; #1 = Employee-of-{period} with a title (⚡/🌟/🏆/👑). Team score = average of qualified members. Awards computed **live** (never persisted). 90s TTL cache.

---

## 11. Sub-contractor Hiring  (`/subcon-hiring`, module `subcon_hiring`)  — `server/routes/subconHiring.js`
- 4 tables **self-created in the route file** (`39-99`): `subcon_hiring`, `subcon_hiring_steps`, `subcon_hiring_files`, `subcon_hiring_candidates`. Enums are **SQL-comment-only (no CHECK)** — enforced app-side.
- **14-step / 2-phase state machine** (`STEP_META 118-133`):
  - **Phase 1 Pre-Award (1-7):** 1 Project Kickoff · 2 BOQ Scope Split · 3 Source Vendors · 4 **Pre-Qualify [GATE: score≥7 → 5, else loop to 3]** · 5 RFQ & Negotiate · 6 Award Decision · 7 LOI to Vendor.
  - **Phase 2 Onboarding (8-14):** 8 KYC & Vendor Master · 9 MSA+NDA · 10 Safety Induction · 11 Mobilization Plan **[GATE: docs → 12, else loop to 8]** · 12 Issue Work Order · 13 Mobilization Advance · 14 Site Entry & Setup (→ status `completed`).
- Non-gate steps auto-advance; gates go through `POST /:id/gate/:gate` with client-supplied `{pass}`. Award sets `awarded_vendor_id` but does **not** advance steps.
- **Hiring → Master is MANUAL, never automatic:** candidates/awarded vendor are FK refs into an **already-existing** `sub_contractors` row (candidate-add 404s otherwise); completing 14 steps only flips `status='completed'`.

## 12. Sub-contractor Master  (`/sub-contractors`, module `sub_contractors`)  — `server/routes/subcontractors.js`
- `sub_contractors` (`schema.js:1079-1090` + Google-Form ALTERs `3533-3552`): name, phone, state/district, `contractor_type`, experience, manpower, with_tools, has_gst/gst_number, rate_in_budget, work_order_file, `active` (0/1). CRUD + `/lookup` (for DPR pickers). Legacy `status CHECK(qualified|…)` column is **dead** (code uses `active`).

---

## Consolidated flaws / risks (verified)

| # | Area | Severity | Issue |
|---|---|---|---|
| H1 | Hiring (hr.js) | 🔴 High | **No `requirePermission`** on candidate/JD/induction/training/question CRUD — any logged-in user can create/edit/**delete**. (Parallel hrSystem.js is correctly gated.) |
| H2 | Hiring | 🔴 High | **Two parallel ATS systems** (`candidates` vs `hr_candidates`) — divergent enums/tokens, no data sharing, unclear source of truth. |
| H3 | hrSystem offer accept | 🟠 | `/offers/accept/:token` is behind auth → broken as a public link (dead). |
| H4 | Scoring | 🟠 | Champions `/leaderboard?period=year` recomputes every user × ~52 weeks → heavy (90s cache only). |
| H5 | Scoring | 🟠 | higher_better KPIs can exceed 100 but lower_better capped at 100 → roles heavy in lower_better can't out-rank (fairness). |
| H6 | Scoring | 🟡 | Fully-manual templates have `activity=0` → **never qualify** in Champions. |
| H7 | Scoring | 🟡 | 20 role templates in `seedScoring.js` may be **dead on fresh installs** if schema KPI-card seed creates templates first (seed only runs when table empty). **[verify seed order]** |
| H8 | Subcon | 🟡 | Enums are comment-only (no CHECK); gate trusts client `{pass}` (score≥7 not enforced); orphaned uploaded files on delete. |
| H9 | Subcon master | 🟡 | Export-CSV maps nonexistent field names → blank columns; server requires only `name`. |
| H10 | Attendance | 🟡 | Week-off = Sunday only, not configurable. |
| H11 | Perms | 🟡 | Scoring/Champions/subcon `GET`s are auth-only — any user can read everyone's comparative performance. |
| H12 | Hiring | 🟡 | `candidates` unindexed on status/email/phone; `GET /candidates/:id/docs` writes seed rows on a read. |
| H13 | Attendance | 🟠 | **Monthly-grid one-click cycle ↔ proof gate collision:** the grid's `markCell` posts to `/admin-mark` with no `proof_url`, so cycling a **past** day to present/half now returns 400 (proof gate `397-400`). The deliberate Backfill modal + "P all" bulk pass proof correctly; only the grid quick-cycle is caught. Unplanned side-effect of the 07-24 gate landing on the older (June-13) grid cycle. Fix pending a product decision (inline proof prompt vs route-to-modal vs exempt grid). |

## Fixed this engagement (see `docs/PAYROLL-ATTENDANCE-CHANGES-2026-07.md`)
Payroll lock/unlock integrity + audit; OT eligible-only display + tooltip (tooltip now keyed on
actual OT hours/pay, not the per-hour rate — a zero-OT row reads "No overtime", a fractional-OT
row shows the real rate); lates→absent + per-minute late penalty; bifurcated compliant export;
attendance backdating proof; roster (2 shifts) + roster-aware late; monthly-grid In/Out + week-off
tags + click-detail; UTC→IST "today" fix.
