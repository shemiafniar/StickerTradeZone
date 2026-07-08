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
