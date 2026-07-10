import { describe, expect, it } from "vitest";
import {
  isOwned,
  isMissing,
  availableDuplicates,
  hasDuplicateAvailable,
  summarizeQuantities,
  getStickerCellState,
} from "@/lib/collectionStatus";

describe("isOwned", () => {
  it("quantity 0 is not owned (missing)", () => {
    expect(isOwned(0)).toBe(false);
  });
  it("quantity 1 is owned", () => {
    expect(isOwned(1)).toBe(true);
  });
  it("quantity 2+ is owned", () => {
    expect(isOwned(5)).toBe(true);
  });
});

describe("isMissing", () => {
  it("quantity 0 is missing", () => {
    expect(isMissing(0)).toBe(true);
  });
  it("quantity 1+ is not missing", () => {
    expect(isMissing(1)).toBe(false);
    expect(isMissing(3)).toBe(false);
  });
});

describe("availableDuplicates", () => {
  it("quantity 0 has 0 available duplicates", () => {
    expect(availableDuplicates(0)).toBe(0);
  });
  it("quantity 1 has 0 available duplicates (owned, no duplicate)", () => {
    expect(availableDuplicates(1)).toBe(0);
  });
  it("quantity 2 has 1 available duplicate", () => {
    expect(availableDuplicates(2)).toBe(1);
  });
  it("quantity 3 has 2 available duplicates", () => {
    expect(availableDuplicates(3)).toBe(2);
  });
  it("never goes negative even for a hypothetically negative input", () => {
    expect(availableDuplicates(-5)).toBe(0);
  });
});

describe("hasDuplicateAvailable", () => {
  it("is false at quantity 0 and 1", () => {
    expect(hasDuplicateAvailable(0)).toBe(false);
    expect(hasDuplicateAvailable(1)).toBe(false);
  });
  it("is true at quantity 2+", () => {
    expect(hasDuplicateAvailable(2)).toBe(true);
    expect(hasDuplicateAvailable(10)).toBe(true);
  });
});

describe("getStickerCellState", () => {
  it("maps null (no row) to 'none'", () => {
    expect(getStickerCellState(null)).toBe("none");
  });
  it("maps 0 to 'missing'", () => {
    expect(getStickerCellState(0)).toBe("missing");
  });
  it("maps 1 to 'owned'", () => {
    expect(getStickerCellState(1)).toBe("owned");
  });
  it("maps 2+ to 'owned_with_duplicates'", () => {
    expect(getStickerCellState(2)).toBe("owned_with_duplicates");
    expect(getStickerCellState(7)).toBe("owned_with_duplicates");
  });
});

describe("summarizeQuantities", () => {
  it("returns all zeros for an empty collection", () => {
    expect(summarizeQuantities([])).toEqual({
      ownedUnique: 0,
      missingUnique: 0,
      duplicateUnique: 0,
      totalDuplicateCopies: 0,
    });
  });

  it("correctly categorizes a realistic mix of quantities", () => {
    // 0 = missing, 1 = owned/no dup, 2 = owned + 1 dup, 3 = owned + 2 dup, 5 = owned + 4 dup
    const result = summarizeQuantities([0, 0, 1, 1, 1, 2, 3, 5]);
    expect(result.missingUnique).toBe(2);
    expect(result.ownedUnique).toBe(6); // every quantity >= 1
    expect(result.duplicateUnique).toBe(3); // the 2, 3, and 5
    expect(result.totalDuplicateCopies).toBe(1 + 2 + 4); // 7
  });

  it("owned + missing always sums to the total number of rows", () => {
    const quantities = [0, 1, 2, 0, 3, 1];
    const result = summarizeQuantities(quantities);
    expect(result.ownedUnique + result.missingUnique).toBe(quantities.length);
  });
});
