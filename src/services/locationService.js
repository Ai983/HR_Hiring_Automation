import { supabase } from "../supabaseClient.js";
import { haversine } from "../lib/geofence.js";

// ─── GEOFENCE SITES (admin CRUD) ─────────────────────────────────────────────

export async function fetchGeofences({ activeOnly = false } = {}) {
  let q = supabase.from("geofence_settings").select("*").order("site_name", { ascending: true });
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createGeofence(site) {
  const { data, error } = await supabase
    .from("geofence_settings")
    .insert({
      site_id:       site.site_id?.trim() || null,
      site_name:     site.site_name.trim(),
      latitude:      Number(site.latitude),
      longitude:     Number(site.longitude),
      radius_meters: Number(site.radius_meters) || 200,
      active:        site.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGeofence(id, updates) {
  const patch = {};
  if (updates.site_id       !== undefined) patch.site_id       = updates.site_id?.trim() || null;
  if (updates.site_name     !== undefined) patch.site_name     = updates.site_name.trim();
  if (updates.latitude      !== undefined) patch.latitude      = Number(updates.latitude);
  if (updates.longitude     !== undefined) patch.longitude     = Number(updates.longitude);
  if (updates.radius_meters !== undefined) patch.radius_meters = Number(updates.radius_meters);
  if (updates.active        !== undefined) patch.active        = updates.active;

  const { data, error } = await supabase
    .from("geofence_settings")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGeofence(id) {
  const { error } = await supabase.from("geofence_settings").delete().eq("id", id);
  if (error) throw error;
}

// ─── PINGS (client insert — advisory tracking data, §2a) ─────────────────────

export async function insertPing({ employee_id, latitude, longitude, accuracy, address, site_name }) {
  if (!supabase) return;
  const { error } = await supabase.from("location_tracking").insert({
    employee_id,
    latitude:  latitude ?? null,
    longitude: longitude ?? null,
    accuracy:  accuracy ?? null,
    address:   address ?? null,
    site_name: site_name ?? null,
  });
  if (error) throw error;
}

// ─── LIVE: latest ping per tracked employee within N minutes ─────────────────

export async function fetchLive({ staleMinutes = 30 } = {}) {
  const since = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("location_tracking")
    .select("*, employees ( employee_code, full_name, department, designation, track_location )")
    .gte("captured_at", since)
    .order("captured_at", { ascending: false });
  if (error) throw error;

  // Keep only the newest ping per employee, and only tracked employees.
  const seen = new Map();
  for (const row of data || []) {
    if (!seen.has(row.employee_id)) {
      seen.set(row.employee_id, {
        ...row,
        minutes_ago: Math.round((Date.now() - new Date(row.captured_at).getTime()) / 60000),
      });
    }
  }
  // Order: GPS_OFF first, then Outside, then on-site.
  const rank = (s) => (s === "GPS_OFF" ? 0 : s === "Outside" ? 1 : 2);
  return [...seen.values()].sort((a, b) => rank(a.site_name) - rank(b.site_name));
}

// ─── LATEST: last-known ping per tracked employee within horizon (team map) ──

export async function fetchLatest({ horizonDays = 7, staleMinutes = 15 } = {}) {
  const since = new Date(Date.now() - horizonDays * 86400 * 1000).toISOString();
  const { data, error } = await supabase
    .from("location_tracking")
    .select("*, employees ( employee_code, full_name, department, designation, track_location )")
    .gte("captured_at", since)
    .not("latitude", "is", null)
    .order("captured_at", { ascending: false });
  if (error) throw error;

  const seen = new Map();
  for (const row of data || []) {
    if (!seen.has(row.employee_id)) {
      const ageMs = Date.now() - new Date(row.captured_at).getTime();
      seen.set(row.employee_id, { ...row, live: ageMs <= staleMinutes * 60 * 1000 });
    }
  }
  return [...seen.values()];
}

// ─── TIMELINE: one employee's day + teleport/spoof detector ──────────────────

const SUSPICIOUS_KMH = 120;

export async function fetchTimeline({ employeeId, date }) {
  const start = new Date(date + "T00:00:00").toISOString();
  const end   = new Date(date + "T23:59:59").toISOString();

  const [{ data: pingsRaw, error: pErr }, { data: att, error: aErr }] = await Promise.all([
    supabase
      .from("location_tracking")
      .select("*")
      .eq("employee_id", employeeId)
      .gte("captured_at", start)
      .lte("captured_at", end)
      .order("captured_at", { ascending: true }),
    supabase
      .from("attendance")
      .select("type, recorded_at, address, status")
      .eq("employee_id", employeeId)
      .gte("recorded_at", start)
      .lte("recorded_at", end)
      .order("recorded_at", { ascending: true }),
  ]);
  if (pErr) throw pErr;
  if (aErr) throw aErr;

  const checkIn  = (att || []).find((r) => r.type === "check_in")?.recorded_at || null;
  const checkOut = (att || []).find((r) => r.type === "check_out")?.recorded_at || null;

  let totalDistance = 0;
  let suspiciousCount = 0;
  let lastTrusted = null; // { lat, lng, t }

  const pings = (pingsRaw || []).map((p) => {
    const out = { ...p, suspicious: false, distance_from_prev_m: 0, speed_kmh: 0 };

    // relation to punches
    const t = new Date(p.captured_at).getTime();
    if (checkIn && t < new Date(checkIn).getTime())       out.phase = "before";
    else if (checkOut && t > new Date(checkOut).getTime()) out.phase = "after";
    else                                                   out.phase = "during";

    if (p.latitude != null && p.longitude != null) {
      if (lastTrusted) {
        const d = haversine(lastTrusted.lat, lastTrusted.lng, p.latitude, p.longitude);
        const dtHr = (t - lastTrusted.t) / 3_600_000;
        const kmh = dtHr > 0 ? (d / 1000) / dtHr : 0;
        out.distance_from_prev_m = Math.round(d);
        out.speed_kmh = Math.round(kmh);
        if (kmh > SUSPICIOUS_KMH) {
          out.suspicious = true;
          suspiciousCount++;
          // exclude from total; don't advance the trusted pointer
          return out;
        }
        totalDistance += d;
      }
      lastTrusted = { lat: p.latitude, lng: p.longitude, t };
    }
    return out;
  });

  return {
    pings,
    total_distance_m: Math.round(totalDistance),
    suspicious_count: suspiciousCount,
    attendance: { check_in: checkIn, check_out: checkOut, records: att || [] },
  };
}

// Employees to offer in the timeline picker: tracked field staff PLUS anyone
// who has any recorded location point (e.g. from a punch).
export async function fetchTrackedEmployees() {
  const { data: pinged } = await supabase.from("location_tracking").select("employee_id");
  const ids = [...new Set((pinged || []).map((r) => r.employee_id))];
  const orFilter = ids.length ? `track_location.eq.true,id.in.(${ids.join(",")})` : "track_location.eq.true";
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_code, full_name, department, track_location")
    .eq("is_active", true)
    .or(orFilter)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}
