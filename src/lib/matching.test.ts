import { describe, expect, it } from "vitest";
import { computeMatches, type MatchCandidateInput } from "@/lib/matching";

function candidate(overrides: Partial<MatchCandidateInput>): MatchCandidateInput {
  return {
    userId: "u1",
    fullName: "אספן",
    city: "תל אביב יפו",
    neighborhood: null,
    duplicateCodes: [],
    forSaleCodes: [],
    priceByCode: {},
    missingCodes: [],
    distanceKm: null,
    approxLat: null,
    approxLng: null,
    locationSource: null,
    ...overrides,
  };
}

describe("computeMatches", () => {
  it("excludes candidates with zero overlap", () => {
    const result = computeMatches(
      ["GER-1", "GER-2"],
      ["FRA-3", "FRA-4"],
      "תל אביב יפו",
      [candidate({ userId: "u1", duplicateCodes: ["POR-9"], missingCodes: ["POR-10"] })]
    );
    expect(result).toEqual([]);
  });

  it("computes give/receive overlap correctly", () => {
    const result = computeMatches(
      ["GER-1", "GER-2"], // my duplicates
      ["FRA-3", "FRA-4"], // my missing
      "תל אביב יפו",
      [candidate({ userId: "u1", duplicateCodes: ["FRA-3", "POR-5"], missingCodes: ["GER-1", "POR-6"] })]
    );
    expect(result).toHaveLength(1);
    expect(result[0].theyHaveThatINeed).toEqual(["FRA-3"]);
    expect(result[0].theyNeedThatIHave).toEqual(["GER-1"]);
    expect(result[0].score).toBe(2);
  });

  it("prioritizes real distance over city fallback ranking", () => {
    const nearButDifferentCity = candidate({
      userId: "far-city-close-distance",
      city: "אילת", // different region -> locationRank 2
      duplicateCodes: ["GER-3"],
      distanceKm: 1,
    });
    const sameCityNoDistance = candidate({
      userId: "same-city-no-distance",
      city: "תל אביב יפו", // same city -> locationRank 0, but no shared location
      duplicateCodes: ["GER-3"],
      distanceKm: null,
    });

    const result = computeMatches([], ["GER-3"], "תל אביב יפו", [sameCityNoDistance, nearButDifferentCity]);

    // Distance-based results always come before city-fallback results, even
    // though the fallback candidate is technically in the same city.
    expect(result.map((r) => r.userId)).toEqual(["far-city-close-distance", "same-city-no-distance"]);
  });

  it("sorts distance-based candidates by distance ascending", () => {
    const result = computeMatches(
      [],
      ["GER-1"],
      "תל אביב יפו",
      [
        candidate({ userId: "far", duplicateCodes: ["GER-1"], distanceKm: 10 }),
        candidate({ userId: "near", duplicateCodes: ["GER-1"], distanceKm: 2 }),
      ]
    );
    expect(result.map((r) => r.userId)).toEqual(["near", "far"]);
  });

  it("breaks distance ties by stickers-needed then stickers-given", () => {
    const result = computeMatches(
      ["POR-10"],
      ["GER-1", "GER-2"],
      "תל אביב יפו",
      [
        candidate({ userId: "gives-one", duplicateCodes: ["GER-1"], missingCodes: ["POR-10"], distanceKm: 5 }),
        candidate({
          userId: "gives-two",
          duplicateCodes: ["GER-1", "GER-2"],
          missingCodes: ["POR-10"],
          distanceKm: 5,
        }),
      ]
    );
    expect(result.map((r) => r.userId)).toEqual(["gives-two", "gives-one"]);
  });

  it("falls back to city/region ranking when no candidate has a shared distance", () => {
    const result = computeMatches(
      [],
      ["GER-1"],
      "תל אביב יפו",
      [
        candidate({ userId: "same-region", city: "רמת גן", duplicateCodes: ["GER-1"] }),
        candidate({ userId: "same-city", city: "תל אביב יפו", duplicateCodes: ["GER-1"] }),
        candidate({ userId: "other-region", city: "אילת", duplicateCodes: ["GER-1"] }),
      ]
    );
    expect(result.map((r) => r.userId)).toEqual(["same-city", "same-region", "other-region"]);
  });

  it("surfaces for-sale stickers the current user needs, with price", () => {
    const result = computeMatches(
      [],
      ["POR-7"],
      "תל אביב יפו",
      [
        candidate({
          userId: "seller",
          duplicateCodes: ["POR-7"],
          forSaleCodes: ["POR-7"],
          priceByCode: { "POR-7": 5 },
        }),
      ]
    );
    expect(result[0].forSaleThatINeed).toEqual([{ code: "POR-7", price: 5 }]);
  });
});
