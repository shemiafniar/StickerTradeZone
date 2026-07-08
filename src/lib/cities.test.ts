import { describe, expect, it } from "vitest";
import { getLocationRank, getRegionForCity, ISRAEL_CITIES } from "@/lib/cities";

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
});
