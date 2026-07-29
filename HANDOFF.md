# HireFlow — Attendance / Location / SSO Handoff

_Last updated: 2026-07-29_

Scope of this document: everything built **after the SEPL `HRMS.md` was shared** — the
attendance + location + universal-login foundation. **Most of `HRMS.md` (payroll, full
roster, performance, holidays, etc.) is NOT built yet** — see [Not started](#not-started).

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

## 3. Current state (verified working)

- Admin app: hub login → module-gated UI. Verified with a temp user (attendance-only vs hireflow).
- Attendance portal: hub login → PIN-free check-in (JWT). Verified end-to-end.
- Team Map: returns punched locations (verified via the exact `fetchLatest` query).
- `notify-attendance`: dry-run verified — **53 recipients**, correct message. **Nothing sent.**
- Dev server runs on **http://localhost:5174/** (5173 is taken by another local hub app).

---

## 4. In the middle / pending decisions

- **Notification blast NOT sent.** Needs: (1) a **public URL** for the portal, (2) go-ahead
  (test-to-one-number first, then ~52 staff). Trigger: `POST /functions/v1/notify-attendance`
  with `{ portal_url, dry_run? , test_phone? }` as an admin.
- **App not deployed publicly** — only localhost. Employees can't reach it yet (Vercel/Railway TBD).
- **No "Notify employees" button** in the admin UI — only the edge function exists.
- **PIN is vestigial** — punching uses SSO now; the PIN field in "HR Settings" does nothing and
  should be removed (plus `setEmployeePin` / `pin` column cleanup).
- Unused `getSession` import remains in `AppContext.jsx` (harmless).

---

## 5. Not started

Rest of SEPL `HRMS.md`: **payroll & salary structures, full roster/shift management, performance,
holiday calendar**, and related modules. Only the attendance/location/employees/auth slice is done.

---

## 6. Run & verify

```bash
npm install
npm run dev          # http://localhost:5174/  (admin app)
                     # http://localhost:5174/attend.html  (employee portal)
```
Log in with any Hagerstone Hub email + password. Access follows the person's modules.

**Secrets** live in the local `env` file (gitignored) and as Supabase edge-function secrets.
Edge functions deploy with: `npx supabase functions deploy <name> --project-ref tpfvnerrjhqwipyonngf`.

---

## 7. Security notes

- `env`, `.env`, `db-connections.json`, `db-*.json/mjs` are gitignored — **never commit secrets.**
- `hr.employees` view is security-definer (bypasses RLS) so any authenticated user can read the
  full roster via it. Acceptable for now; harden later if needed.

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
| `n8n-workflows/SETUP.md` | The 8 hiring-automation n8n workflows (WhatsApp/MayTAPI) + import instructions. |
| `DEPLOY-NOTES.md` | ⚠️ Deploy steps written for the **old** standalone project `sgerslbmnwrltqrhsdir` ("Hiring System"), **not** the current hub `tpfvnerrjhqwipyonngf`. Treat as historical. |
| `RUN-IN-SQL-EDITOR.sql` | ⚠️ One-off location schema for the **old** project `sgerslbmnwrltqrhsdir`. Superseded by `supabase/hub-migration/*.sql`. Historical. |
| `HANDOFF.md` | This document. |

**Reading order for a new dev:** `hagerstone-hiring-automation-blueprint.md` → `HANDOFF.md` (this) →
`LOCATION-TRACKING-SYSTEM.md` → `LOCATION-TRACKING-HIREFLOW-PLAN.md` → `HRMS.md` (for the road ahead).
