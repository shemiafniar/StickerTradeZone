import { describe, expect, it } from "vitest";
import { formatDistanceHebrew, roundCoordinate } from "@/lib/distance";

describe("formatDistanceHebrew", () => {
  it("formats sub-kilometer distances in rounded meters", () => {
    expect(formatDistanceHebrew(0.5)).toBe("500 מ׳");
  });

  it("rounds meters to the nearest 10", () => {
    expect(formatDistanceHebrew(0.234)).toBe("230 מ׳");
  });

  it("never shows 0 meters", () => {
    expect(formatDistanceHebrew(0.001)).toBe("10 מ׳");
  });

  it("formats distances under 10km with one decimal", () => {
    expect(formatDistanceHebrew(2.34)).toBe("2.3 ק״מ");
  });

  it("formats distances 10km and over as whole numbers", () => {
    expect(formatDistanceHebrew(12.7)).toBe("13 ק״מ");
  });
});

describe("roundCoordinate", () => {
  it("rounds to 3 decimal places (~100m precision)", () => {
    expect(roundCoordinate(32.0853123)).toBe(32.085);
  });

  it("handles negative coordinates", () => {
    expect(roundCoordinate(-34.78156)).toBe(-34.782);
  });
});
