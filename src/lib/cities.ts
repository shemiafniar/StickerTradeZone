import { ISRAEL_LOCALITIES } from "@/lib/data/israelLocalities";

/**
 * Curated region groupings for a handful of well-known cities, kept for
 * backward compatibility with `getRegionForCity()`'s existing contract and
 * test expectations. This is intentionally NOT maintained for all ~1,180
 * localities in `israelLocalities.ts` - `getLocationRank()` below falls
 * back to real coordinate proximity for everything outside this curated
 * set, which is what makes the full dataset useful without requiring a
 * hand-maintained region for every small town/village.
 */
export const CITY_REGIONS: Record<string, string[]> = {
  "מרכז": [
    "תל אביב יפו",
    "רמת גן",
    "גבעתיים",
    "בני ברק",
    "חולון",
    "בת ים",
    "פתח תקווה",
    "ראשון לציון",
    "רמת השרון",
    "הרצליה",
    "כפר סבא",
    "רעננה",
    "אור יהודה",
    "קרית אונו",
    "יהוד מונוסון",
  ],
  "שפלה ודרום מרכז": [
    "רחובות",
    "נס ציונה",
    "יבנה",
    "אשדוד",
    "אשקלון",
    "קרית גת",
    "לוד",
    "רמלה",
    "מודיעין מכבים רעות",
  ],
  "שרון": ["נתניה", "הוד השרון", "כפר יונה", "טירה", "קלנסווה"],
  "חיפה והצפון": [
    "חיפה",
    "קרית אתא",
    "קרית ביאליק",
    "קרית מוצקין",
    "קרית ים",
    "נשר",
    "טבריה",
    "נצרת",
    "עפולה",
    "כרמיאל",
    "עכו",
    "נהריה",
    "צפת",
  ],
  "ירושלים והסביבה": ["ירושלים", "בית שמש", "מעלה אדומים"],
  "דרום": ["באר שבע", "אילת", "דימונה", "אופקים", "נתיבות", "שדרות"],
};

/**
 * Every selectable locality name, sorted for Hebrew display. This is a
 * superset of the original ~50-city list this app shipped with - every one
 * of those original names is preserved character-for-character (see
 * israelLocalities.ts's provenance notes), so existing `profiles.city`
 * values already stored in the database remain valid/selectable. Includes
 * ~1,180 Israeli cities, local councils, and towns (e.g. עתלית), sourced
 * from Israel's official settlement geolocation data - see README.md.
 */
export const ISRAEL_CITIES: string[] = ISRAEL_LOCALITIES.map((l) => l.name).sort((a, b) =>
  a.localeCompare(b, "he")
);

const CITY_TO_REGION: Map<string, string> = new Map();
for (const [region, cities] of Object.entries(CITY_REGIONS)) {
  for (const city of cities) {
    CITY_TO_REGION.set(city, region);
  }
}

const CITY_TO_COORDS: Map<string, { lat: number; lng: number }> = new Map(
  ISRAEL_LOCALITIES.map((l) => [l.name, { lat: l.lat, lng: l.lng }])
);

export function getRegionForCity(city: string): string | null {
  return CITY_TO_REGION.get(city) ?? null;
}

/** Approximate city-center coordinates for a locality name, or null if unknown. */
export function getCityCoordinates(city: string): { lat: number; lng: number } | null {
  return CITY_TO_COORDS.get(city) ?? null;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

/** Cities within this real distance of each other count as "nearby" for the rank-1 fallback below. */
const NEARBY_CITY_RADIUS_KM = 15;

/**
 * Location proximity rank: lower is closer/better.
 * 0 = same city, 1 = same region (or, for localities outside the curated
 * region list above, within ~15km by real coordinates), 2 = elsewhere/unknown.
 *
 * This is the fallback used when real GPS-based distance isn't available
 * (see `nearby_locations()`/`computeMatches()`) - keep the same
 * (lower-is-closer) numeric contract so callers/sorting don't need to change.
 */
export function getLocationRank(cityA: string, cityB: string): 0 | 1 | 2 {
  if (!cityA || !cityB) return 2;
  if (cityA === cityB) return 0;

  const regionA = getRegionForCity(cityA);
  const regionB = getRegionForCity(cityB);
  if (regionA && regionA === regionB) return 1;

  const coordsA = getCityCoordinates(cityA);
  const coordsB = getCityCoordinates(cityB);
  if (coordsA && coordsB && haversineKm(coordsA, coordsB) <= NEARBY_CITY_RADIUS_KM) return 1;

  return 2;
}

export const LOCATION_RANK_LABEL: Record<0 | 1 | 2, string> = {
  0: "באותה עיר",
  1: "באזור קרוב",
  2: "אזור אחר",
};
