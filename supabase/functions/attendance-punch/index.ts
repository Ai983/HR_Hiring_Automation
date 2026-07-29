// ============================================================
// attendance-punch — server-authoritative punch + geofence enforcement.
// The browser cannot be trusted to self-certify "inside", so the real
// inside/outside decision runs here with the service-role key.
// Plan: LOCATION-TRACKING-HIREFLOW-PLAN.md §5
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateGeofence, DEFAULT_GEO_SETTINGS } from "../_shared/geofence.ts";

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
    const { type, latitude, longitude, accuracy, address, selfie_url } = body ?? {};
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
      site_id: geo?.matchedSiteId ?? null,
      site_name: geo ? (geo.matchedSite ?? "Outside") : null,
      location_verified: geo ? geo.verified : true,
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
      location_verified: verified,
      message: verified
        ? message
        : `${message} Location unconfirmed — recorded and flagged for review.`,
    }, 201);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
