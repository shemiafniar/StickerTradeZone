import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom, mockRpc, tableMocks } = vi.hoisted(() => {
  const tableMocks = new Map<string, unknown>();
  return {
    mockGetUser: vi.fn(),
    mockRpc: vi.fn(async () => ({ data: [] })),
    mockFrom: vi.fn((table: string) => {
      const impl = tableMocks.get(table);
      if (!impl) throw new Error(`No mock registered for table "${table}"`);
      return impl;
    }),
    tableMocks,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/data/stickers", () => ({
  getStickerIdToCodeMap: vi.fn(async () => new Map([["s-need", "FRA-1"], ["s-mine", "GER-1"]])),
}));

import { getMatchesForCurrentUser } from "@/lib/data/matches";

const ME = { id: "me" };
const OTHER = { id: "other", full_name: "אחר", city: "תל אביב יפו", neighborhood: null, location_enabled: false };
const MY_PROFILE = { id: "me", city: "תל אביב יפו", location_enabled: false, matches_first_viewed_at: "2026-01-01T00:00:00Z" };

function setupTables(userStickerRows: { user_id: string; sticker_id: string; quantity: number; listing_type?: string; price?: number | null }[]) {
  tableMocks.set("profiles", {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((col: string) => {
      // Platform-wide read (paginated via fetchAllRows -> .range()).
      if (col === "status") return { range: vi.fn().mockResolvedValue({ data: [OTHER] }) };
      // Single-row lookup for the current user - never paginated.
      return { maybeSingle: vi.fn().mockResolvedValue({ data: MY_PROFILE }) };
    }),
  });
  tableMocks.set("user_stickers", {
    select: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: userStickerRows.map((r) => ({ listing_type: "trade", price: null, ...r })),
    }),
  });
}

describe("getMatchesForCurrentUser - quantity-aware duplicate/missing detection", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockRpc.mockClear();
    tableMocks.clear();
    mockGetUser.mockResolvedValue({ data: { user: ME } });
  });

  it("does NOT treat a quantity-1 sticker (owned, no spare) as an offerable duplicate", async () => {
    setupTables([
      { user_id: "other", sticker_id: "s-mine", quantity: 1 }, // other user owns it, but has no spare
      { user_id: "me", sticker_id: "s-need", quantity: 0 }, // I'm missing GER-1... wait, need FRA-1
    ]);
    // I'm missing s-mine's code (GER-1); other only has quantity 1 (no duplicate) -> no match.
    const { matches } = await getMatchesForCurrentUser();
    expect(matches).toHaveLength(0);
  });

  it("DOES treat a quantity-2 sticker (owned + 1 available duplicate) as offerable", async () => {
    setupTables([
      { user_id: "other", sticker_id: "s-mine", quantity: 2 }, // other has 1 available duplicate
      { user_id: "me", sticker_id: "s-mine", quantity: 0 }, // I'm explicitly missing it
    ]);
    const { matches } = await getMatchesForCurrentUser();
    expect(matches).toHaveLength(1);
    expect(matches[0].theyHaveThatINeed).toContain("GER-1");
  });

  it("an explicit quantity-0 row is missing, but a quantity-1 row is not missing and produces no match on its own", async () => {
    setupTables([
      { user_id: "other", sticker_id: "s-need", quantity: 2 }, // other can give me FRA-1
      { user_id: "me", sticker_id: "s-need", quantity: 0 }, // I'm missing FRA-1 (explicit)
      { user_id: "me", sticker_id: "s-mine", quantity: 1 }, // I merely own GER-1, no spare - not a giveable duplicate
    ]);
    const { matches } = await getMatchesForCurrentUser();
    expect(matches).toHaveLength(1);
    expect(matches[0].theyHaveThatINeed).toEqual(["FRA-1"]);
    expect(matches[0].theyNeedThatIHave).toEqual([]);
  });

  it("reports hasCollectionData = false when the user has no missing/duplicate rows at all", async () => {
    setupTables([]);
    const { hasCollectionData } = await getMatchesForCurrentUser();
    expect(hasCollectionData).toBe(false);
  });

  it("reports hasCollectionData = true once the user has at least one explicit missing or duplicate row", async () => {
    setupTables([{ user_id: "me", sticker_id: "s-need", quantity: 0 }]);
    const { hasCollectionData } = await getMatchesForCurrentUser();
    expect(hasCollectionData).toBe(true);
  });

  it("reports hasCollectionData = true for a user who has only plain-owned stickers (quantity 1, no duplicates, nothing missing) - regression guard", async () => {
    setupTables([
      { user_id: "me", sticker_id: "s-mine", quantity: 1 },
      { user_id: "me", sticker_id: "s-need", quantity: 1 },
    ]);
    const { hasCollectionData } = await getMatchesForCurrentUser();
    expect(hasCollectionData).toBe(true);
  });
});
