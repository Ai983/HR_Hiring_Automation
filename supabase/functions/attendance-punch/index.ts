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

// IST-aware late check: check-in after 09:30 IST is 'late'.
function isLateIST(nowUtc: Date): boolean {
  const ist = new Date(nowUtc.getTime() + 5.5 * 60 * 60 * 1000);
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins > 9 * 60 + 30;
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

    // HR-specific tracking flag lives in hr.employee_profile.
    const { data: prof } = await supabase
      .from("employee_profile").select("track_location").eq("employee_id", emp.id).single();
    const track_location = prof?.track_location ?? false;

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

    // ── 2. Geofence enforcement — only for tracked employees ──
    let geo = null;
    if (track_location) {
      if (latitude == null || longitude == null) {
        return json({ error: "Location required. Please enable GPS and try again." }, 400);
      }

      const { data: sites } = await supabase
        .from("geofence_settings")
        .select("site_id, site_name, latitude, longitude, radius_meters")
        .eq("active", true);

      geo = evaluateGeofence(latitude, longitude, accuracy, sites ?? [], DEFAULT_GEO_SETTINGS);

      // Decision #2 (plan §9): no sites configured → allow + flag (never break
      // attendance mid-rollout). Only a precise off-site lock blocks.
      if (!geo.allow) {
        const dist = geo.nearestDist ?? 0;
        return json({
          error: `You appear to be about ${dist} m from ${geo.nearestSite ?? "any site"}. ` +
                 `Please punch from an authorised site.`,
          decision: geo.decision,
        }, 400);
      }
    }

    // ── 2b. The employee picks their site (as the old Google Form did). GPS is
    // a cross-check only: a mismatch is flagged for review, never blocked,
    // because plenty of sites have no coordinates recorded yet.
    let pickedSite: { id: string; name: string; latitude: number | null; longitude: number | null; radius_meters: number } | null = null;
    let siteMatch: string | null = null;
    let siteDistance: number | null = null;

    if (site_id) {
      const { data: s } = await supabase
        .from("sites").select("id, name, latitude, longitude, radius_meters")
        .eq("id", site_id).single();
      pickedSite = s ?? null;
      if (pickedSite) {
        if (latitude == null || longitude == null) siteMatch = "no_gps";
        else if (pickedSite.latitude == null || pickedSite.longitude == null) siteMatch = "no_coords";
        else {
          siteDistance = Math.round(
            haversine(latitude, longitude, pickedSite.latitude, pickedSite.longitude),
          );
          const slack = Math.min(Math.max(accuracy ?? 0, 0), 3000);
          siteMatch = siteDistance - slack <= pickedSite.radius_meters ? "ok" : "mismatch";
        }
      }
    }

    // ── 3. Build the attendance row (keeps existing row-per-event shape) ──
    const status =
      type === "check_in" ? (isLateIST(now) ? "late" : "present") : "present";

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
      // legacy geofence result (only populated for tracked field staff)
      site_id: geo?.matchedSiteId ?? null,
      location_verified: geo ? geo.verified : true,
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
