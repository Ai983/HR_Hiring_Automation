# Location Tracking — Deployment Steps

Everything is coded and the app builds. Two things must happen on your Supabase
project (`sgerslbmnwrltqrhsdir` — "Hiring System") before the feature is live.

---

## ✅ Step 1 — Run the SQL  (required)

**File:** [RUN-IN-SQL-EDITOR.sql](RUN-IN-SQL-EDITOR.sql)

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Paste the whole file → **Run**
3. Check the verification output at the bottom (expects: 2 new tables, 4 new
   attendance columns, 1 employee flag)

Safe to re-run — it destroys nothing and changes nothing on a second run.

---

## ⚠️ Step 2 — Deploy the Edge Function  (recommended, not blocking)

**Function:** [supabase/functions/attendance-punch/index.ts](supabase/functions/attendance-punch/index.ts)
(it imports [supabase/functions/_shared/geofence.ts](supabase/functions/_shared/geofence.ts))

### Why it matters
The app has **no backend** — the browser writes straight to Supabase. That means
a user could, in principle, send fake coordinates and claim to be on-site. The
Edge Function exists to make the inside/outside decision **server-side**, where
it can't be forged.

### What happens if you skip it
Nothing breaks. The portal detects the function is missing and falls back to a
direct insert, evaluating the geofence in the browser instead. But:

| | Function deployed | Fallback (not deployed) |
|---|---|---|
| Punch works | ✅ | ✅ |
| Off-site punch blocked | ✅ enforced | ❌ recorded, not blocked |
| `location_verified` | true when GPS confirms site | **always false** (flagged) |
| Spoofable | No | Yes |

So without it you still get **full tracking and an audit trail** — every punch is
just marked "unconfirmed" for review. You lose *enforcement*, not data.

### How to deploy it
**Option A — Dashboard (no tooling):**
Dashboard → **Edge Functions** → **Deploy a new function** → name it exactly
`attendance-punch` → paste the code. Note: you'll need to inline the
`_shared/geofence.ts` import, since the dashboard editor is single-file.

**Option B — CLI (handles the shared import properly):**
```bash
npx supabase login
npx supabase link --project-ref sgerslbmnwrltqrhsdir
npx supabase functions deploy attendance-punch
```

No secrets to configure — the function uses `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects automatically.

---

## Step 3 — Turn it on for people  (in the app, no SQL)

1. **Geofence Sites** panel → **+ Add Site** → name it, then hit
   **📍 Use my current location** while standing at the office (or paste
   coordinates from Google Maps). Set the radius (200 m is a sensible default).
2. **Employees** panel → **Edit** a field/site employee → tick
   **"Enable location tracking"** → Save.

Nobody is tracked until you do step 3.2 — the flag defaults to off for everyone,
including office staff.

---

## Step 4 — Verify it works

1. Open the attendance portal (`/attend.html`) on a phone, sign in with an
   employee you enabled.
2. The Location card should show a coloured pill: **On site** (green) /
   **Weak GPS** (amber) / **Away from site** (red).
3. Punch in. Then in the admin app:
   - **Attendance** → the row should show a **Site** and, if GPS was confident,
     no "⚠ Flagged" badge.
   - **Location Tracking → Live** → that employee appears within ~30 s.
   - **Location Tracking → Timeline** → pick them + today to see the route.

---

## Free-tier note

You're on the Free plan (500 MB database). Pings at 30 s use roughly **2 MB per
day per 10 tracked employees**, so with 60-day retention:

| Tracked staff | 60-day storage |
|---|---|
| 10 | ~130 MB ✅ |
| 25 | ~325 MB ⚠️ |
| 50 | ~650 MB ❌ over limit |

Fine for a field-staff pilot. Before going much past ~20 tracked people, either
raise the ping interval (the `30000` in
[AttendancePortal.jsx](src/components/attendance/AttendancePortal.jsx)) or shorten
retention in `purge_old_location_pings()`.

Also: `pg_cron` may not be enabled on your project, so the 60-day cleanup is a
plain function — call `select public.purge_old_location_pings();` periodically,
or wire it into your existing n8n daily cron.
