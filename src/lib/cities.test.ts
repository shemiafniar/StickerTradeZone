import { describe, expect, it } from "vitest";
import { getCityCoordinates, getLocationRank, getRegionForCity, ISRAEL_CITIES } from "@/lib/cities";

describe("getLocationRank", () => {
  it("returns 0 for the same city", () => {
    expect(getLocationRank("תל אביב יפו", "תל אביב יפו")).toBe(0);
  });

  it("returns 1 for cities in the same region", () => {
    expect(getLocationRank("תל אביב יפו", "רמת גן")).toBe(1);
  });

  it("returns 2 for cities in different regions", () => {
    expect(getLocationRank("תל אביב יפו", "אילת")).toBe(2);
  });

  it("returns 2 when either city is empty/unknown", () => {
    expect(getLocationRank("", "תל אביב יפו")).toBe(2);
    expect(getLocationRank("תל אביב יפו", "")).toBe(2);
  });

  it("falls back to real coordinate proximity for localities outside the curated region list", () => {
    // עתלית and טירת כרמל are ~8km apart and neither is in any curated
    // CITY_REGIONS bucket - only the coordinate fallback can rank them as
    // nearby.
    expect(getLocationRank("עתלית", "טירת כרמל")).toBe(1);
  });

  it("still returns 2 for real localities that are genuinely far apart", () => {
    expect(getLocationRank("עתלית", "אילת")).toBe(2);
  });
});

describe("getRegionForCity", () => {
  it("finds the region for a known city", () => {
    expect(getRegionForCity("חיפה")).toBe("חיפה והצפון");
  });

  it("returns null for an unknown city", () => {
    expect(getRegionForCity("לא קיים")).toBeNull();
  });
});

describe("ISRAEL_CITIES", () => {
  it("has no duplicate entries", () => {
    expect(new Set(ISRAEL_CITIES).size).toBe(ISRAEL_CITIES.length);
  });

  it("is sorted", () => {
    const sorted = [...ISRAEL_CITIES].sort((a, b) => a.localeCompare(b, "he"));
    expect(ISRAEL_CITIES).toEqual(sorted);
  });

  it("is a much more complete dataset than the original ~50-city list", () => {
    expect(ISRAEL_CITIES.length).toBeGreaterThan(1000);
  });

  it("includes previously-missing localities like Atlit", () => {
    expect(ISRAEL_CITIES).toContain("עתלית");
  });

  it("still includes every original city name unchanged, for DB compatibility with existing profiles", () => {
    const originalCities = [
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
      "רחובות",
      "נס ציונה",
      "יבנה",
      "אשדוד",
      "אשקלון",
      "קרית גת",
      "לוד",
      "רמלה",
      "מודיעין מכבים רעות",
      "נתניה",
      "הוד השרון",
      "כפר יונה",
      "טירה",
      "קלנסווה",
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
      "ירושלים",
      "בית שמש",
      "מעלה אדומים",
      "באר שבע",
      "אילת",
      "דימונה",
      "אופקים",
      "נתיבות",
      "שדרות",
    ];
    for (const city of originalCities) {
      expect(ISRAEL_CITIES).toContain(city);
    }
  });
});

describe("getCityCoordinates", () => {
  it("returns approximate coordinates for a known city", () => {
    const coords = getCityCoordinates("ירושלים");
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(31.78, 0);
    expect(coords!.lng).toBeCloseTo(35.23, 0);
  });

  it("returns null for an unknown city", () => {
    expect(getCityCoordinates("לא קיים")).toBeNull();
  });
});
