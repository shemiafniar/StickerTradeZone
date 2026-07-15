import { describe, expect, it } from "vitest";
import {
  formatStickerCodesByTeam,
  isValidStickerCode,
  isValidStickerNumberForTeam,
  normalizeStickerCode,
  parseStickerCodes,
  serializeStickerCodes,
  stickerNumberRangeForTeam,
} from "@/lib/stickerCodes";

describe("isValidStickerCode", () => {
  it("accepts well-formed codes", () => {
    expect(isValidStickerCode("GER-2")).toBe(true);
    expect(isValidStickerCode("FRA-17")).toBe(true);
    expect(isValidStickerCode("isr-1")).toBe(true);
    expect(isValidStickerCode("POR-20")).toBe(true);
  });

  it("rejects malformed or out-of-range codes", () => {
    expect(isValidStickerCode("GER-21")).toBe(false);
    expect(isValidStickerCode("GER-0")).toBe(false);
    expect(isValidStickerCode("GE-2")).toBe(false);
    expect(isValidStickerCode("GERM-2")).toBe(false);
    expect(isValidStickerCode("GER2")).toBe(false);
    expect(isValidStickerCode("")).toBe(false);
  });
});

/**
 * FWC (the bonus "FIFA World Cup" set added through the admin catalog, not
 * one of the official 48 national teams) is the one team that numbers its
 * 20 stickers 0-19 instead of every ordinary team's 1-20 - see
 * supabase/migrations/0019_fwc_numbering.sql.
 */
describe("FWC's special 0-19 numbering range", () => {
  it("FWC's first sticker (number 0) is valid", () => {
    expect(isValidStickerCode("FWC-0")).toBe(true);
    expect(normalizeStickerCode("fwc-0")).toBe("FWC-0");
  });

  it("FWC's last sticker (number 19) is valid", () => {
    expect(isValidStickerCode("FWC-19")).toBe(true);
    expect(normalizeStickerCode("FWC-19")).toBe("FWC-19");
  });

  it("FWC-20 is invalid (out of FWC's range)", () => {
    expect(isValidStickerCode("FWC-20")).toBe(false);
    expect(normalizeStickerCode("FWC-20")).toBeNull();
  });

  it("an ordinary team's number 0 is invalid (ordinary teams start at 1, not 0)", () => {
    expect(isValidStickerCode("GER-0")).toBe(false);
    expect(normalizeStickerCode("GER-0")).toBeNull();
  });

  it("an ordinary team's number 1 is valid", () => {
    expect(isValidStickerCode("GER-1")).toBe(true);
  });

  it("an ordinary team's number 20 is valid", () => {
    expect(isValidStickerCode("GER-20")).toBe(true);
  });

  it("an ordinary team's number 21 is invalid", () => {
    expect(isValidStickerCode("GER-21")).toBe(false);
  });

  it("stickerNumberRangeForTeam/isValidStickerNumberForTeam agree with isValidStickerCode for both team kinds, case-insensitively", () => {
    expect(stickerNumberRangeForTeam("FWC")).toEqual({ min: 0, max: 19 });
    expect(stickerNumberRangeForTeam("fwc")).toEqual({ min: 0, max: 19 });
    expect(stickerNumberRangeForTeam("GER")).toEqual({ min: 1, max: 20 });

    expect(isValidStickerNumberForTeam("FWC", 0)).toBe(true);
    expect(isValidStickerNumberForTeam("FWC", 19)).toBe(true);
    expect(isValidStickerNumberForTeam("FWC", 20)).toBe(false);
    expect(isValidStickerNumberForTeam("GER", 0)).toBe(false);
    expect(isValidStickerNumberForTeam("GER", 1)).toBe(true);
    expect(isValidStickerNumberForTeam("GER", 20)).toBe(true);
    expect(isValidStickerNumberForTeam("GER", 21)).toBe(false);
  });
});

describe("FWC ordering is numeric, not lexicographic", () => {
  it("formatStickerCodesByTeam groups FWC's double-digit numbers in correct numeric order, not string order", () => {
    // Lexicographic order would produce "0, 1, 10, 11, ..., 19, 2, 3, ...".
    const codes = ["FWC-0", "FWC-1", "FWC-2", "FWC-9", "FWC-10", "FWC-19"];
    expect(formatStickerCodesByTeam(codes)).toBe("FWC 0-2, 9-10, 19");
  });
});

describe("normalizeStickerCode", () => {
  it("uppercases the team code", () => {
    expect(normalizeStickerCode("ger-2")).toBe("GER-2");
    expect(normalizeStickerCode(" fra-17 ")).toBe("FRA-17");
  });

  it("returns null for invalid input", () => {
    expect(normalizeStickerCode("GER-99")).toBeNull();
    expect(normalizeStickerCode("not a code")).toBeNull();
  });
});

describe("parseStickerCodes", () => {
  it("parses comma-separated codes", () => {
    expect(parseStickerCodes("GER-2, FRA-17, POR-5")).toEqual(["FRA-17", "GER-2", "POR-5"]);
  });

  it("parses newline-separated codes", () => {
    expect(parseStickerCodes("GER-2\nFRA-17\nPOR-5")).toEqual(["FRA-17", "GER-2", "POR-5"]);
  });

  it("de-duplicates and normalizes case", () => {
    expect(parseStickerCodes("ger-2, GER-2, Ger-2")).toEqual(["GER-2"]);
  });

  it("skips invalid tokens", () => {
    expect(parseStickerCodes("GER-2, not-a-code, FRA-99, POR-5")).toEqual(["GER-2", "POR-5"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseStickerCodes("")).toEqual([]);
    expect(parseStickerCodes("   ")).toEqual([]);
  });
});

describe("formatStickerCodesByTeam", () => {
  it("groups consecutive numbers per team into ranges", () => {
    expect(formatStickerCodesByTeam(["GER-1", "GER-2", "GER-3", "GER-17"])).toBe("GER 1-3, 17");
  });

  it("joins multiple teams", () => {
    expect(formatStickerCodesByTeam(["FRA-17", "GER-1", "GER-2"])).toBe("FRA 17 · GER 1-2");
  });

  it("returns an empty string for no codes", () => {
    expect(formatStickerCodesByTeam([])).toBe("");
  });
});

describe("serializeStickerCodes", () => {
  it("joins codes with commas", () => {
    expect(serializeStickerCodes(["GER-1", "FRA-17"])).toBe("GER-1,FRA-17");
  });
});
