import { describe, expect, it } from "vitest";
import { formatStickerNumbersAsRanges, parseStickerNumbers } from "@/lib/stickerInput";

describe("parseStickerNumbers", () => {
  it("parses comma-separated single numbers", () => {
    expect(parseStickerNumbers("1,2,3")).toEqual([1, 2, 3]);
  });

  it("parses a range", () => {
    expect(parseStickerNumbers("1-5")).toEqual([1, 2, 3, 4, 5]);
  });

  it("parses a mix of ranges and single numbers", () => {
    expect(parseStickerNumbers("1-3, 8, 10-12")).toEqual([1, 2, 3, 8, 10, 11, 12]);
  });

  it("de-duplicates overlapping input", () => {
    expect(parseStickerNumbers("1-5, 3, 4, 5-7")).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("normalizes a reversed range", () => {
    expect(parseStickerNumbers("10-8")).toEqual([8, 9, 10]);
  });

  it("ignores non-numeric junk", () => {
    expect(parseStickerNumbers("1, abc, 3, , 5")).toEqual([1, 3, 5]);
  });

  it("ignores zero and negative-looking input", () => {
    expect(parseStickerNumbers("0, -1, 2")).toEqual([2]);
  });

  it("respects a maxNumber ceiling", () => {
    expect(parseStickerNumbers("1-10", 5)).toEqual([1, 2, 3, 4, 5]);
    expect(parseStickerNumbers("50", 5)).toEqual([]);
  });

  it("supports newline-separated input", () => {
    expect(parseStickerNumbers("1\n2\n3")).toEqual([1, 2, 3]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseStickerNumbers("")).toEqual([]);
  });
});

describe("formatStickerNumbersAsRanges", () => {
  it("collapses consecutive numbers into a range", () => {
    expect(formatStickerNumbersAsRanges([1, 2, 3, 4, 5])).toBe("1-5");
  });

  it("keeps non-consecutive numbers separate", () => {
    expect(formatStickerNumbersAsRanges([1, 3, 5])).toBe("1, 3, 5");
  });

  it("mixes ranges and singles", () => {
    expect(formatStickerNumbersAsRanges([1, 2, 3, 7, 9, 10])).toBe("1-3, 7, 9-10");
  });

  it("sorts unsorted input before formatting", () => {
    expect(formatStickerNumbersAsRanges([5, 1, 3, 2, 4])).toBe("1-5");
  });

  it("returns an empty string for an empty array", () => {
    expect(formatStickerNumbersAsRanges([])).toBe("");
  });

  it("round-trips through parseStickerNumbers", () => {
    const original = "1-5, 8, 12-14";
    const parsed = parseStickerNumbers(original);
    const formatted = formatStickerNumbersAsRanges(parsed);
    expect(parseStickerNumbers(formatted)).toEqual(parsed);
  });
});
