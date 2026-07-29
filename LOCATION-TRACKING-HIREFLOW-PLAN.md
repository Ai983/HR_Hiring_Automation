# Location Tracking + Geofenced Attendance — HireFlow Implementation Plan

**Source spec:** [LOCATION-TRACKING-SYSTEM.md](LOCATION-TRACKING-SYSTEM.md) (SEPL: SQLite + Express + React JS)
**Reference (wrong target):** [LOCATION-TRACKING-HUB-PLAN.md](LOCATION-TRACKING-HUB-PLAN.md) — written for the "Hagerstone Hub" (React 19 + **TS strict** + `auth.users` + `projects`). **That is not this repo.** Use it for *logic ideas only*, not file paths/types.
**Target (this repo):** `hireflow` — React **18 + plain JSX**, Vite, **Supabase client-only** (no server), **PIN login** (`employees.employee_code` + `pin`, no `auth.users`), 7 existing Deno Edge Functions.

**Goal:** Add geofenced enforcement + continuous location tracking to the *existing* attendance system in this repo, reusing what's already here.

---

## 0. What this repo already has (don't rebuild)

| Capability | Where | Reuse as-is |
|---|---|---|
| Employee punch UI (PIN login, clock, selfie, location, leave) | [AttendancePortal.jsx](src/components/attendance/AttendancePortal.jsx) (entry `attend.html` → [attend-main.jsx](src/attend-main.jsx)) | ✅ extend |
| Admin attendance table (filters, CSV, map links, edit/delete) | [AttendanceAdmin.jsx](src/components/panels/AttendanceAdmin.jsx) | ✅ extend |
| Attendance data + service layer | [attendanceService.js](src/services/attendanceService.js) | ✅ extend |
| GPS capture + reverse-geocode (Nominatim) | AttendancePortal.jsx:24, :392 | ✅ upgrade to best-fix |
| Selfie capture + `selfies` storage bucket | AttendancePortal.jsx:37, :134 | ✅ |
| Late detection (9:30 cutoff) | AttendancePortal.jsx:445 | ✅ move server-side |
| Edge Function pattern (service-role, CORS, `Deno.serve`) | [screen-resume/index.ts](supabase/functions/screen-resume/index.ts) | ✅ copy shape |
| Admin nav wiring (`panel` state) | [Sidebar.jsx:62](src/components/layout/Sidebar.jsx#L62), AppContext | ✅ add entries |

### Current data model (important difference from SEPL/Hub)
- [schema-attendance.sql](supabase/schema-attendance.sql): `attendance` is **one row per event** (`type: check_in | check_out`, `recorded_at`), **not** one row-per-day with `punch_in_*/punch_out_*` columns. **Keep this shape** — the whole UI + admin + CSV depend on it. We add location columns *to the event row*, we do not restructure.
- Employee identity is `employees.id` (uuid) + PIN. **No `auth.users`, no JWT, no RLS by user.** RLS is currently wide-open (`using(true)`). This changes how we secure the Edge Functions (see §5).

---

## 1. Gap analysis — what "location tracking" actually adds

| Feature | Now | To build |
|---|---|---|
| **Geofence sites** (define offices/sites) | ❌ none | `geofence_settings` table + admin CRUD |
| **Inside/outside decision** on punch | ❌ punch always allowed anywhere | `evaluateGeofence()` port + enforcement |
| **Best-fix GPS** (`watchPosition`, accuracy-honest) | ❌ single `getCurrentPosition` (AttendancePortal.jsx:395) | upgrade `fetchLocation` |
| **Continuous 30s pings** | ❌ location only at punch | `location_tracking` table + ping loop |
| **`accuracy` stored** | ❌ not captured | add column, capture `pos.coords.accuracy` |
| **`track_location` opt-out** | ❌ | `employees.track_location` column |
| **Live "who's where now"** admin | ❌ | new panel, reads latest ping/user |
| **Team map + Route/timeline** (Leaflet) | ❌ | new components + `leaflet`/`react-leaflet` |
| **Teleport/spoof detector** (>120 km/h) | ❌ | pure-JS check in timeline |

---

## 2. Architecture decision: where does the geofence decision run?

SEPL/Hub run it **server-side** so a client can't forge "inside". This repo has **no server** and the browser writes to Supabase directly with the **anon key** under wide-open RLS — a user *could* insert any coords.

**Decision: put enforcement in a Supabase Edge Function** (`attendance-punch`), copying the [screen-resume](supabase/functions/screen-resume/index.ts) pattern (service-role key, CORS, `Deno.serve`). The client stops inserting `attendance` rows directly for punches and instead invokes the function, which:
1. re-validates the PIN/employee, 2. loads geofences, 3. runs `evaluateGeofence`, 4. writes with service-role.

**Pings** (`location-ping`) are lower-stakes (read-only surveillance data, never block). Two options:
- **(a) Simplest:** client inserts pings directly into `location_tracking` (wide-open RLS, same as today's attendance). Site match computed client-side for display; re-derived honestly on admin read.
- **(b) Consistent:** pings also go through a `location-ping` Edge Function.

**Recommendation:** **(a)** for v1 (matches this repo's current trust model and keeps it simple), with a note that pings are advisory and the *punch* is the enforced/audited event. Move to (b) if/when the app adopts real auth.

> ⚠️ **Honest caveat:** with PIN auth + anon key, even the Edge Function can only trust "this PIN was presented." True anti-spoofing (mock-location) is out of scope — **the selfie remains the real proof of presence**, exactly as SEPL concludes.

---

## 3. Data model — new migration `supabase/schema-location.sql`

Keep everything lowercase `public`, keyed to `employees.id` (not `auth.users`).

### 3a. `geofence_settings` — defined sites
```sql
create table if not exists public.geofence_settings (
  id            uuid primary key default gen_random_uuid(),
  site_id       text,
  site_name     text not null,
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meters int not null default 200,
  active        boolean not null default true,
  created_at    timestamptz default now()
);
```

### 3b. `location_tracking` — every GPS ping
```sql
create table if not exists public.location_tracking (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  captured_at  timestamptz not null default now(),
  latitude     double precision,       -- null when gps_off
  longitude    double precision,
  accuracy     double precision,
  address      text,
  site_name    text                    -- matched site | 'Outside' | 'GPS_OFF'
);
create index if not exists idx_loc_emp_time on public.location_tracking(employee_id, captured_at desc);
```

### 3c. Extend existing `attendance` (additive columns — **do not restructure**)
```sql
alter table public.attendance
  add column if not exists accuracy          double precision,
  add column if not exists site_id           text,
  add column if not exists site_name         text,
  add column if not exists location_verified boolean default true;
```

### 3d. Opt-out flag
```sql
alter table public.employees
  add column if not exists track_location boolean not null default false;
-- seed true for field roles once confirmed, e.g.:
-- update public.employees set track_location = true
--   where designation ilike '%site%' or designation ilike '%project%';
```

### 3e. RLS (match repo's current open posture)
```sql
alter table public.geofence_settings enable row level security;
alter table public.location_tracking enable row level security;
create policy "allow_all_geofence" on public.geofence_settings for all using (true) with check (true);
create policy "allow_all_loc"      on public.location_tracking for all using (true) with check (true);
```

### 3f. 60-day purge
`pg_cron` daily `delete from location_tracking where captured_at < now() - interval '60 days';`
(or add to an existing n8n daily cron — the repo already runs n8n workflows).

---

## 4. Shared geofence logic — pure JS port

Two copies of the same math (as SEPL does), both ports of `server/lib/geofence.js`:
- **`supabase/functions/_shared/geofence.ts`** — used by `attendance-punch` (the trusted decision).
- **`src/lib/geofence.js`** — display-only mirror for the live status pill in the portal.

Both implement:
- `haversine(lat1,lon1,lat2,lon2) → metres`
- `evaluateGeofence(lat, lng, accuracy, geofences, settings) → {allow, verified, decision, matchedSite, nearestSite, nearestDist, accuracyUsed}`

**Rule preserved exactly:** clamp accuracy to `[floor 50, ceiling 3000]`; match when `distance − acc ≤ radius`; a weak fix (`accuracy > trust 200`) **can never block**; only a precise lock confidently beyond `radius + blockBuffer 300` returns `allow:false`. Thresholds hardcoded with defaults in v1 (optional `location_settings` k/v table later).

---

## 5. Edge Function — `supabase/functions/attendance-punch/index.ts`

Copy [screen-resume](supabase/functions/screen-resume/index.ts) skeleton (CORS + `Deno.serve` + service-role client).

**Request:** `{ employee_id, pin, type: 'check_in'|'check_out', latitude, longitude, accuracy, address, selfie_url }`

**Flow:**
1. Re-verify `employee_id` + `pin` + `is_active` (client can't be trusted).
2. Load `geofence_settings where active`. If none → **allow but flag** (`location_verified=false`, `site_name=null`) OR 400 "No sites configured" — **decision needed** (see §9 Q2). SEPL blocks; but this repo's staff may punch from many places → suggest *allow+flag* until sites are seeded.
3. If `track_location=false` for this employee → skip geofence entirely, insert as today (backward-compatible for office staff).
4. Else `geo = evaluateGeofence(...)`. If `!geo.allow` → **400** with "you appear to be ~Nm from `<site>`".
5. Late check server-side (IST 9:30) for `check_in`.
6. Insert `attendance` row with `accuracy`, `site_id`, `site_name`, `location_verified = geo.verified`.
7. Return `{ ok, location_verified, message }`.

Client change: [AttendancePortal.jsx](src/components/attendance/AttendancePortal.jsx) `handleSubmit` (line 439) swaps its direct `supabase.from("attendance").insert(...)` for `supabase.functions.invoke("attendance-punch", ...)`.

---

## 6. Employee portal changes — [AttendancePortal.jsx](src/components/attendance/AttendancePortal.jsx)

1. **`getBestPosition()`** — replace single `getCurrentPosition` (line 395) with `watchPosition({enableHighAccuracy})`, keep most-accurate fix, resolve early at ≤40 m or after 15 s, always clean up. Capture `pos.coords.accuracy`.
2. **Background ping loop** — new `useEffect`: while logged in, every 30 s POST a ping to `location_tracking` (client insert per §2a) with best fix; on GPS error insert `site_name='GPS_OFF'` row. Only run when `employee.track_location === true`. Clear interval on sign-out/unmount.
3. **Live status pill** — small green/amber/red indicator driven by `src/lib/geofence.js` mirror, so the employee sees what the punch will do.
4. **Wire accuracy** into the punch payload; call the Edge Function (§5); surface its error toast (the "Nm from site" message).
5. Show a friendly "location tracking not enabled for your role" note when `track_location` is false (still allows normal punch).

---

## 7. Admin changes

### 7a. Geofence CRUD — new panel `src/components/panels/GeofenceSites.jsx`
Add/edit/deactivate sites (name, lat, lng, radius, active). New service functions in a `locationService.js`. Wire into [Sidebar.jsx:62](src/components/layout/Sidebar.jsx#L62) navItems + AppContext panel switch. A "capture my current location" button to fill lat/lng.

### 7b. Location columns in existing admin — [AttendanceAdmin.jsx](src/components/panels/AttendanceAdmin.jsx)
Surface `site_name` + a "Verified/Flagged" badge (`location_verified`) in the table + CSV. Small, high-value, no new deps.

### 7c. Live / Team-map / Timeline — new panel `src/components/panels/LocationTracking.jsx`
Three tabs:
- **Live** — latest ping per tracked employee within N minutes (cards, Google-Maps links, GPS-off red). Pure SQL query via `locationService.js`.
- **Team Map** — `src/components/location/TeamMap.jsx` (Leaflet): one marker/employee + geofence circles.
- **Timeline** — employee + date picker → `RouteMap.jsx` polyline + start/end markers + geofence circles + movement table, with the **>120 km/h teleport detector** (pure JS over ordered pings, excludes bogus legs from distance total).

> The maps (7c) are the only part needing new dependencies: `leaflet`, `react-leaflet`. 7a + 7b need none.

---

## 8. New/changed files summary

```
supabase/schema-location.sql                         NEW  (§3)
supabase/functions/_shared/geofence.ts               NEW  (§4)
supabase/functions/attendance-punch/index.ts         NEW  (§5)
src/lib/geofence.js                                  NEW  (§4 mirror)
src/services/locationService.js                      NEW  (geofence CRUD + ping + live/timeline reads)
src/components/attendance/AttendancePortal.jsx        EDIT (§6)
src/components/panels/AttendanceAdmin.jsx             EDIT (§7b)
src/components/panels/GeofenceSites.jsx               NEW  (§7a)
src/components/panels/LocationTracking.jsx            NEW  (§7c)
src/components/location/TeamMap.jsx                   NEW  (§7c)
src/components/location/RouteMap.jsx                  NEW  (§7c)
src/components/layout/Sidebar.jsx                     EDIT (2 nav entries)
src/App.jsx / src/context/AppContext.jsx             EDIT (panel routing)
package.json                                          EDIT (+leaflet, +react-leaflet)
```

---

## 9. Phased delivery

| Phase | Deliverable | Verify |
|---|---|---|
| **P0 — Schema** | `schema-location.sql`: 3 objects + `attendance` columns + `track_location` + RLS + purge | Run in SQL editor; insert a fake geofence + ping |
| **P1 — Enforcement** | `_shared/geofence.ts` + `attendance-punch` fn; portal calls it; accuracy + best-fix GPS | On-site coord → inserts verified; far precise coord → 400 |
| **P2 — Admin surface** | `GeofenceSites` CRUD + site/verified columns in `AttendanceAdmin` | Create a site; punch shows matched site + badge |
| **P3 — Continuous tracking** | Ping loop in portal + `location_tracking` writes + **Live** tab | Pings land every 30 s; Live tab shows who's where |
| **P4 — Maps** | `leaflet`/`react-leaflet` + Team Map + Timeline + teleport detector | Route renders; >120 km/h ping flagged |
| **P5 — Rollout** | Seed `track_location` for field roles; pilot 2–3 staff | Pilot punches on-site; office staff unaffected |

---

## 10. Open questions (decide before P1)

1. **Field roles** — which `designation`/`department` values get `track_location=true`? (Seeds the opt-in.)
2. **No-sites behaviour** — before any geofence is seeded, should punch **block** ("no sites configured", SEPL-style) or **allow + flag**? Recommend allow+flag so attendance never breaks mid-rollout.
3. **Punch path** — OK to route punches through an Edge Function (needed for trustworthy enforcement), or keep direct client insert and accept that "inside" is unenforceable? Recommend Edge Function.
4. **Ping trust** — client-insert pings (simple, §2a) vs `location-ping` Edge Function (consistent, §2b)? Recommend client-insert for v1.
5. **Privacy/consent** — continuous GPS of staff is compliance-sensitive (DPDP). Recommend a written consent + the `track_location` opt-out before widening past pilot.
6. **Battery/data** — 30 s `watchPosition` on field phones; make interval configurable and pause when backgrounded.
```
