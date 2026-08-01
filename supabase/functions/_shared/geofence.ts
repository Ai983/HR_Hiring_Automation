// ============================================================
// Shared geofence math — server-authoritative decision.
// Direct port of the SEPL rule (LOCATION-TRACKING-SYSTEM.md §3).
// Pure math, no DB deps. Used by the attendance-punch Edge Function.
// A JS mirror lives at src/lib/geofence.js for the client status pill.
// ============================================================

export interface Geofence {
  site_id?: string | null;
  site_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export interface GeoSettings {
  floor: number;    // min slack every fix gets (ignore jitter)
  ceiling: number;  // max benefit-of-the-doubt
  trust: number;    // a fix this precise is a real lock we can block on
  blockBuffer: number; // extra slack past the radius edge before we ever block
}

export const DEFAULT_GEO_SETTINGS: GeoSettings = {
  floor: 50,
  ceiling: 3000,
  trust: 200,
  blockBuffer: 300,
};

export interface GeoDecision {
  allow: boolean;
  verified: boolean;
  decision: "inside" | "coarse_allow" | "outside" | "no_sites";
  matchedSite: string | null;
  matchedSiteId: string | null;
  nearestSite: string | null;
  nearestDist: number | null;
  accuracyUsed: number;
}

// Great-circle distance between two GPS points, in metres.
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// The "uncertainty-honest" rule.
// A weak GPS fix can never block an on-site person. You are only ever rejected
// when your phone has a precise lock placing you clearly far from every site.
export function evaluateGeofence(
  lat: number,
  lng: number,
  accuracy: number | null | undefined,
  geofences: Geofence[],
  settings: GeoSettings = DEFAULT_GEO_SETTINGS,
): GeoDecision {
  const valid = (geofences ?? []).filter(
    (g) => typeof g.latitude === "number" && typeof g.longitude === "number",
  );
  if (valid.length === 0) {
    return {
      allow: true,
      verified: false,
      decision: "no_sites",
      matchedSite: null,
      matchedSiteId: null,
      nearestSite: null,
      nearestDist: null,
      accuracyUsed: 0,
    };
  }
  geofences = valid;

  // 1. Clamp accuracy: a coarse fix earns more slack, a jittery fix a 50m floor.
  const rawAcc = typeof accuracy === "number" && accuracy > 0 ? accuracy : settings.ceiling;
  const acc = Math.min(Math.max(rawAcc, settings.floor), settings.ceiling);

  // 2. Find nearest + matched site (uncertainty circle overlaps the site).
  let nearestSite: string | null = null;
  let nearestDist = Infinity;
  let matched: Geofence | null = null;

  for (const g of geofences) {
    const dist = haversine(lat, lng, g.latitude, g.longitude);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestSite = g.site_name;
    }
    if (dist - acc <= g.radius_meters && (!matched || dist < nearestDist)) {
      matched = g;
    }
  }

  // 3. goodFix = the RAW accuracy was precise enough to trust.
  const goodFix = rawAcc <= settings.trust;

  // 4. Decide.
  if (matched) {
    return {
      allow: true,
      verified: goodFix,               // coarse overlap is allowed but flagged
      decision: "inside",
      matchedSite: matched.site_name,
      matchedSiteId: matched.site_id ?? null,
      nearestSite,
      nearestDist: Math.round(nearestDist),
      accuracyUsed: Math.round(acc),
    };
  }

  // Not matched + weak fix → we can never prove an indoor person is away.
  if (!goodFix) {
    return {
      allow: true,
      verified: false,
      decision: "coarse_allow",
      matchedSite: null,
      matchedSiteId: null,
      nearestSite,
      nearestDist: Math.round(nearestDist),
      accuracyUsed: Math.round(acc),
    };
  }

  // Not matched + good fix → the only path that CAN block, but still forgive
  // anyone within radius + blockBuffer of the nearest edge.
  const nearest = geofences.reduce((best, g) => {
    const d = haversine(lat, lng, g.latitude, g.longitude);
    return d < best.d ? { g, d } : best;
  }, { g: geofences[0], d: Infinity });

  const edgeDist = nearest.d - nearest.g.radius_meters;
  if (edgeDist <= settings.blockBuffer) {
    return {
      allow: true,
      verified: false,
      decision: "coarse_allow",
      matchedSite: null,
      matchedSiteId: null,
      nearestSite,
      nearestDist: Math.round(nearestDist),
      accuracyUsed: Math.round(acc),
    };
  }

  // Precise lock, confidently far from every site → block.
  return {
    allow: false,
    verified: false,
    decision: "outside",
    matchedSite: null,
    matchedSiteId: null,
    nearestSite,
    nearestDist: Math.round(nearestDist),
    accuracyUsed: Math.round(acc),
  };
}
