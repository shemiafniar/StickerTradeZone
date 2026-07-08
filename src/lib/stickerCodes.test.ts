import { describe, expect, it } from "vitest";
import {
  formatStickerCodesByTeam,
  isValidStickerCode,
  normalizeStickerCode,
  parseStickerCodes,
  serializeStickerCodes,
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
