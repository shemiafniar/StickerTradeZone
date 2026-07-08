/**
 * Israeli cities grouped by region, used for MVP "nearby" matching without
 * real GPS. When real location/distance is added later, `getLocationRank`
 * below is the single seam to replace with a geo-distance calculation -
 * everything else (matching, UI) only depends on that function's contract.
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

export const ISRAEL_CITIES: string[] = Object.values(CITY_REGIONS).flat().sort((a, b) =>
  a.localeCompare(b, "he")
);

const CITY_TO_REGION: Map<string, string> = new Map();
for (const [region, cities] of Object.entries(CITY_REGIONS)) {
  for (const city of cities) {
    CITY_TO_REGION.set(city, region);
  }
}

export function getRegionForCity(city: string): string | null {
  return CITY_TO_REGION.get(city) ?? null;
}

/**
 * Location proximity rank: lower is closer/better.
 * 0 = same city, 1 = same region, 2 = elsewhere / unknown.
 *
 * This is the seam to swap in real GPS distance later - keep the same
 * (lower-is-closer) numeric contract so callers/sorting don't need to change.
 */
export function getLocationRank(cityA: string, cityB: string): 0 | 1 | 2 {
  if (!cityA || !cityB) return 2;
  if (cityA === cityB) return 0;

  const regionA = getRegionForCity(cityA);
  const regionB = getRegionForCity(cityB);
  if (regionA && regionA === regionB) return 1;

  return 2;
}

export const LOCATION_RANK_LABEL: Record<0 | 1 | 2, string> = {
  0: "באותה עיר",
  1: "באזור קרוב",
  2: "אזור אחר",
};
