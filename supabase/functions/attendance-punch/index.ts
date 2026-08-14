// ============================================================
// attendance-punch — server-authoritative punch + geofence enforcement.
// The browser cannot be trusted to self-certify "inside", so the real
// inside/outside decision runs here with the service-role key.
// Plan: LOCATION-TRACKING-HIREFLOW-PLAN.md §5
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateGeofence, DEFAULT_GEO_SETTINGS, haversine } from "../_shared/geofence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// IST-aware late check. The cutoff is NOT hardcoded: it comes from
// hr.attendance_settings.late_after, the same row the attendance_day /
// attendance_month views read. Keep it that way — a second copy of the
// threshold here means the punch log and the reports disagree about who
// was late, and only one of them follows the Attendance Setup screen.
const DEFAULT_LATE_AFTER_MIN = 9 * 60 + 30; // fallback only if the row is missing

// "HH:MM:SS" → minutes past midnight. Returns null on anything unparseable.
function parseTimeToMinutes(t: unknown): number | null {
  const m = typeof t === "string" && t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isLateIST(nowUtc: Date, lateAfterMin: number): boolean {
  const ist = new Date(nowUtc.getTime() + 5.5 * 60 * 60 * 1000);
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins > lateAfterMin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json();
    const { type, latitude, longitude, accuracy, address, selfie_url, site_id } = body ?? {};
    if (type !== "check_in" && type !== "check_out") {
      return json({ error: "type must be check_in or check_out." }, 400);
    }

    // ── 1. Identify the caller from the Hagerstone Hub session (JWT) ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not signed in." }, 401);

    const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: "hr" } });
    const pub = createClient(supabaseUrl, serviceKey, { db: { schema: "public" } });

    // Resolve the employee from the shared master via auth.uid().
    const { data: emp, error: empErr } = await pub
      .from("employees")
      .select("id, name, employee_code, is_active, auth_user_id")
      .eq("auth_user_id", user.id)
      .single();
    if (empErr || !emp) return json({ error: "Your login isn't linked to an employee record." }, 404);
    if (!emp.is_active) return json({ error: "Employee is inactive." }, 403);

    const now = new Date();

    // ── 1b. Reject a punch that repeats today's last one ──
    // A double tap, a stale tab, or a retry after a slow network must not create
    // two check-ins. The portal hides the button, but the server is the guard.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    istNow.setUTCHours(0, 0, 0, 0);                       // 00:00 on today's IST date
    const dayStart = new Date(istNow.getTime() - IST_OFFSET_MS); // back to a UTC instant
    const { data: todays } = await supabase
      .from("attendance")
      .select("type, recorded_at")
      .eq("employee_id", emp.id)
      .gte("recorded_at", dayStart.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(1);
    const lastType = todays?.[0]?.type ?? null;
    if (lastType === type) {
      return json({
        error: type === "check_in"
          ? "You have already checked in today."
          : "You have already checked out.",
        duplicate: true,
      }, 409);
    }
    if (type === "check_out" && lastType === null) {
      return json({ error: "Please check in before checking out.", duplicate: false }, 409);
    }

    // ── 2. Load active sites once (CPS-sourced pick-list + geofence coords). ──
    const { data: sites } = await supabase
      .from("sites")
      .select("id, name, latitude, longitude, radius_meters, geocode_confidence")
      .eq("active", true);

    // Advisory only: which authorised site is the GPS actually near? Used for the
    // block message and the legacy site_id column — not itself a gate.
    let geo = null;
    if (latitude != null && longitude != null) {
      geo = evaluateGeofence(
        latitude, longitude, accuracy,
        (sites ?? []).map((s) => ({
          site_id: s.id, site_name: s.name,
          latitude: s.latitude, longitude: s.longitude,
          radius_meters: s.radius_meters ?? 200,
        })),
        DEFAULT_GEO_SETTINGS,
      );
    }

    // ── 2b. Picked-site gate. The employee declares the site they are at; their
    // GPS must match it. We only ever BLOCK against a coordinate we trust
    // (geocode_confidence 'verified' — an admin-set/confirmed pin). An unverified
    // or uncalibrated site is cross-checked and flagged, never blocked. A site
    // with no coordinates yet self-calibrates from the first precise fix.
    const SITE_BLOCK_BUFFER = 75; // metres of slack past the padded radius before we reject
    let pickedSite:
      | { id: string; name: string; latitude: number | null; longitude: number | null; radius_meters: number; geocode_confidence: string | null }
      | null = null;
    let siteMatch: string | null = null;
    let siteDistance: number | null = null;

    if (site_id) pickedSite = (sites ?? []).find((s) => s.id === site_id) ?? null;

    if (pickedSite) {
      const rawAcc = typeof accuracy === "number" && accuracy > 0 ? accuracy : DEFAULT_GEO_SETTINGS.ceiling;
      const slack = Math.min(Math.max(rawAcc, DEFAULT_GEO_SETTINGS.floor), DEFAULT_GEO_SETTINGS.ceiling);
      const goodFix = rawAcc <= DEFAULT_GEO_SETTINGS.trust;
      const radius = pickedSite.radius_meters ?? 200;

      if (latitude == null || longitude == null) {
        siteMatch = "no_gps";
      } else if (pickedSite.latitude == null || pickedSite.longitude == null) {
        // Seed the site centre from the first precise punch (approx until an admin
        // verifies it on the map). Guarded on latitude is null to avoid races.
        if (goodFix) {
          await supabase.from("sites").update({
            latitude, longitude,
            geocode_confidence: "approx",
            geocode_provider: "calibrated",
            geocoded_at: new Date().toISOString(),
          }).eq("id", pickedSite.id).is("latitude", null);
          siteMatch = "calibrated";
        } else {
          siteMatch = "no_coords";
        }
      } else {
        siteDistance = Math.round(haversine(latitude, longitude, pickedSite.latitude, pickedSite.longitude));
        const outsideBy = siteDistance - slack - radius; // >0 ⇒ beyond the padded edge
        if (outsideBy <= 0) {
          siteMatch = "ok";
        } else if (pickedSite.geocode_confidence === "verified" && goodFix && outsideBy > SITE_BLOCK_BUFFER) {
          return json({
            error: `You are about ${siteDistance} m from ${pickedSite.name} (allowed ${radius} m). ` +
                   `Please check in from the site.`,
            decision: "site_mismatch",
            site_name: pickedSite.name,
            site_distance_m: siteDistance,
          }, 400);
        } else {
          siteMatch = goodFix ? "mismatch" : "weak";
        }
      }
    }

    // ── 3. Build the attendance row (keeps existing row-per-event shape) ──
    // Late cutoff follows Attendance Setup. A failed read must not silently
    // relabel everyone, so fall back to the documented 09:30 default.
    let lateAfterMin = DEFAULT_LATE_AFTER_MIN;
    if (type === "check_in") {
      const { data: settings } = await supabase
        .from("attendance_settings")
        .select("late_after")
        .maybeSingle();
      lateAfterMin = parseTimeToMinutes(settings?.late_after) ?? DEFAULT_LATE_AFTER_MIN;
    }
    const status =
      type === "check_in" ? (isLateIST(now, lateAfterMin) ? "late" : "present") : "present";

    const record: Record<string, unknown> = {
      employee_id: emp.id,
      type,
      recorded_at: now.toISOString(),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      accuracy: accuracy ?? null,
      address: address ?? null,
      selfie_url: selfie_url ?? null,
      status,
      // what the employee chose
      site_ref: pickedSite?.id ?? null,
      site_name: pickedSite?.name ?? (geo ? (geo.matchedSite ?? "Outside") : null),
      site_match: siteMatch,
      site_distance_m: siteDistance,
      // nearest authorised site the GPS actually fell in (advisory)
      site_id: geo?.matchedSiteId ?? null,
      location_verified: siteMatch === null ? true : siteMatch === "ok",
      source: "portal",
    };

    const { error: insErr } = await supabase.from("attendance").insert(record);
    if (insErr) return json({ error: "Failed to save attendance.", details: insErr.message }, 500);

    // Also drop a location point so the punch shows on Live / Team Map / Timeline.
    if (latitude != null && longitude != null) {
      await supabase.from("location_tracking").insert({
        employee_id: emp.id,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        address: address ?? null,
        site_name: (record.site_name as string) ?? null,
      });
    }

    const verified = record.location_verified as boolean;
    const message =
      type === "check_in"
        ? (status === "late" ? "Checked in (marked late)." : "Checked in.")
        : "Checked out.";

    return json({
      ok: true,
      type,
      status,
      site_name: record.site_name,
      site_match: siteMatch,
      site_distance_m: siteDistance,
      location_verified: verified,
      message: siteMatch === "mismatch"
        ? `${message} Your GPS is about ${siteDistance} m from ${pickedSite?.name} — recorded and flagged for review.`
        : verified
          ? message
          : `${message} Location unconfirmed — recorded and flagged for review.`,
    }, 201);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
