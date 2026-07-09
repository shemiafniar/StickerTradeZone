/**
 * Formats a distance in kilometers using friendly Hebrew, matching the
 * product spec's examples ("500 מ׳", "2.3 ק״מ").
 */
export function formatDistanceHebrew(km: number): string {
  if (km < 1) {
    const meters = Math.max(10, Math.round(km * 1000 / 10) * 10);
    return `${meters} מ׳`;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} ק״מ`;
}

/**
 * Rounds raw browser geolocation coordinates to ~100m precision before they
 * ever leave the client, per the "approximate location only" requirement.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Small deterministic offset (up to ~2km) derived from a stable string
 * (e.g. a user id) - used to keep city-center-derived map markers from
 * stacking exactly on top of each other when several users share a city,
 * without needing any real per-user location data (city/neighborhood are
 * already public profile fields, so this isn't a new privacy boundary -
 * it's purely a visual "don't overlap" nicety, same order of magnitude as
 * the server-side GPS jitter in nearby_locations()).
 */
export function deterministicJitter(seed: string): { dLat: number; dLng: number } {
  let hashLat = 0;
  let hashLng = 0;
  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    hashLat = (hashLat * 31 + code) | 0;
    hashLng = (hashLng * 37 + code + 7) | 0;
  }
  return {
    dLat: (hashLat % 2000) / 100000,
    dLng: (hashLng % 2000) / 100000,
  };
}
