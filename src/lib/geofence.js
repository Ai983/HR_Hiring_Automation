// ============================================================
// Client-side geofence mirror — DISPLAY ONLY.
// Same rule as supabase/functions/_shared/geofence.ts, used to drive the
// live green/amber/red status pill in AttendancePortal. Never trusted for the
// actual write — the Edge Function re-runs the real decision server-side.
// ============================================================

export const DEFAULT_GEO_SETTINGS = { floor: 50, ceiling: 3000, trust: 200, blockBuffer: 300 };

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function evaluateGeofence(lat, lng, accuracy, geofences, settings = DEFAULT_GEO_SETTINGS) {
  geofences = (geofences || []).filter(
    (g) => typeof g.latitude === "number" && typeof g.longitude === "number",
  );
  if (geofences.length === 0) {
    return { allow: true, verified: false, decision: "no_sites", matchedSite: null, nearestSite: null, nearestDist: null, accuracyUsed: 0 };
  }

  const rawAcc = typeof accuracy === "number" && accuracy > 0 ? accuracy : settings.ceiling;
  const acc = Math.min(Math.max(rawAcc, settings.floor), settings.ceiling);

  let nearestSite = null;
  let nearestDist = Infinity;
  let matched = null;

  for (const g of geofences) {
    const dist = haversine(lat, lng, g.latitude, g.longitude);
    if (dist < nearestDist) { nearestDist = dist; nearestSite = g.site_name; }
    if (dist - acc <= g.radius_meters && (!matched || dist < nearestDist)) matched = g;
  }

  const goodFix = rawAcc <= settings.trust;

  if (matched) {
    return { allow: true, verified: goodFix, decision: "inside", matchedSite: matched.site_name, nearestSite, nearestDist: Math.round(nearestDist), accuracyUsed: Math.round(acc) };
  }
  if (!goodFix) {
    return { allow: true, verified: false, decision: "coarse_allow", matchedSite: null, nearestSite, nearestDist: Math.round(nearestDist), accuracyUsed: Math.round(acc) };
  }

  const nearest = geofences.reduce((best, g) => {
    const d = haversine(lat, lng, g.latitude, g.longitude);
    return d < best.d ? { g, d } : best;
  }, { g: geofences[0], d: Infinity });

  const edgeDist = nearest.d - nearest.g.radius_meters;
  if (edgeDist <= settings.blockBuffer) {
    return { allow: true, verified: false, decision: "coarse_allow", matchedSite: null, nearestSite, nearestDist: Math.round(nearestDist), accuracyUsed: Math.round(acc) };
  }

  return { allow: false, verified: false, decision: "outside", matchedSite: null, nearestSite, nearestDist: Math.round(nearestDist), accuracyUsed: Math.round(acc) };
}

// Maps a decision to the status-pill UI state.
export function pillState(decision) {
  switch (decision) {
    case "inside":       return { key: "inside",  label: "On site",       color: "#16a34a", bg: "rgba(34,197,94,0.12)" };
    case "coarse_allow": return { key: "weak",    label: "Weak GPS",      color: "#b45309", bg: "rgba(245,158,11,0.12)" };
    case "outside":      return { key: "outside", label: "Away from site", color: "#dc2626", bg: "rgba(239,68,68,0.12)" };
    case "no_sites":     return { key: "no_sites", label: "No sites set",  color: "#8a7e72", bg: "rgba(138,126,114,0.12)" };
    default:             return { key: "locating", label: "Locating…",    color: "#8a7e72", bg: "rgba(138,126,114,0.12)" };
  }
}
