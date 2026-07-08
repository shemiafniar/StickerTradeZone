import { describe, expect, it } from "vitest";
import { computeMatches, type MatchCandidateInput } from "@/lib/matching";

function candidate(overrides: Partial<MatchCandidateInput>): MatchCandidateInput {
  return {
    userId: "u1",
    fullName: "אספן",
    city: "תל אביב יפו",
    neighborhood: null,
    duplicateNumbers: [],
    forSaleNumbers: [],
    priceByNumber: {},
    missingNumbers: [],
    distanceKm: null,
    ...overrides,
  };
}

describe("computeMatches", () => {
  it("excludes candidates with zero overlap", () => {
    const result = computeMatches(
      [1, 2],
      [3, 4],
      "תל אביב יפו",
      [candidate({ userId: "u1", duplicateNumbers: [9], missingNumbers: [10] })]
    );
    expect(result).toEqual([]);
  });

  it("computes give/receive overlap correctly", () => {
    const result = computeMatches(
      [1, 2], // my duplicates
      [3, 4], // my missing
      "תל אביב יפו",
      [candidate({ userId: "u1", duplicateNumbers: [3, 5], missingNumbers: [1, 6] })]
    );
    expect(result).toHaveLength(1);
    expect(result[0].theyHaveThatINeed).toEqual([3]);
    expect(result[0].theyNeedThatIHave).toEqual([1]);
    expect(result[0].score).toBe(2);
  });

  it("prioritizes real distance over city fallback ranking", () => {
    const nearButDifferentCity = candidate({
      userId: "far-city-close-distance",
      city: "אילת", // different region -> locationRank 2
      duplicateNumbers: [3],
      distanceKm: 1,
    });
    const sameCityNoDistance = candidate({
      userId: "same-city-no-distance",
      city: "תל אביב יפו", // same city -> locationRank 0, but no shared location
      duplicateNumbers: [3],
      distanceKm: null,
    });

    const result = computeMatches([], [3], "תל אביב יפו", [sameCityNoDistance, nearButDifferentCity]);

    // Distance-based results always come before city-fallback results, even
    // though the fallback candidate is technically in the same city.
    expect(result.map((r) => r.userId)).toEqual(["far-city-close-distance", "same-city-no-distance"]);
  });

  it("sorts distance-based candidates by distance ascending", () => {
    const result = computeMatches(
      [],
      [1],
      "תל אביב יפו",
      [
        candidate({ userId: "far", duplicateNumbers: [1], distanceKm: 10 }),
        candidate({ userId: "near", duplicateNumbers: [1], distanceKm: 2 }),
      ]
    );
    expect(result.map((r) => r.userId)).toEqual(["near", "far"]);
  });

  it("breaks distance ties by stickers-needed then stickers-given", () => {
    const result = computeMatches(
      [10],
      [1, 2],
      "תל אביב יפו",
      [
        candidate({ userId: "gives-one", duplicateNumbers: [1], missingNumbers: [10], distanceKm: 5 }),
        candidate({ userId: "gives-two", duplicateNumbers: [1, 2], missingNumbers: [10], distanceKm: 5 }),
      ]
    );
    expect(result.map((r) => r.userId)).toEqual(["gives-two", "gives-one"]);
  });

  it("falls back to city/region ranking when no candidate has a shared distance", () => {
    const result = computeMatches(
      [],
      [1],
      "תל אביב יפו",
      [
        candidate({ userId: "same-region", city: "רמת גן", duplicateNumbers: [1] }),
        candidate({ userId: "same-city", city: "תל אביב יפו", duplicateNumbers: [1] }),
        candidate({ userId: "other-region", city: "אילת", duplicateNumbers: [1] }),
      ]
    );
    expect(result.map((r) => r.userId)).toEqual(["same-city", "same-region", "other-region"]);
  });

  it("surfaces for-sale stickers the current user needs, with price", () => {
    const result = computeMatches(
      [],
      [7],
      "תל אביב יפו",
      [
        candidate({
          userId: "seller",
          duplicateNumbers: [7],
          forSaleNumbers: [7],
          priceByNumber: { 7: 5 },
        }),
      ]
    );
    expect(result[0].forSaleThatINeed).toEqual([{ number: 7, price: 5 }]);
  });
});
