import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockFrom, mockGetUser, tableMocks, chainableRange } = vi.hoisted(() => {
  const tableMocks = new Map<string, unknown>();
  return {
    mockGetUser: vi.fn(),
    mockFrom: vi.fn((table: string) => {
      const impl = tableMocks.get(table);
      if (!impl) throw new Error(`No mock registered for table "${table}"`);
      return impl;
    }),
    tableMocks,
    chainableRange: (data: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = {};
      const chain = () => obj;
      obj.select = vi.fn(chain);
      obj.order = vi.fn(chain);
      obj.eq = vi.fn((...args: unknown[]) => {
        // user_stickers.select(...).eq("user_id", userId) resolves directly
        // (no further .range() call in buildCollectionBreakdown for this table).
        obj.lastEqArgs = args;
        return Promise.resolve({ data, error: null });
      });
      obj.range = vi.fn((from: number, to: number) => Promise.resolve({ data: data.slice(from, to + 1), error: null }));
      return obj;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom, auth: { getUser: mockGetUser } })),
}));

import { getMyCollectionForExport } from "@/lib/data/collectionExport";

const USER_ID = "11111111-1111-1111-1111-111111111101";

const TEAMS = [
  { code: "GER", name_he: "גרמניה" },
  { code: "FRA", name_he: "צרפת" },
];

const STICKERS = [
  { id: "s1", team_code: "GER", number: 1, code: "GER-1" },
  { id: "s2", team_code: "GER", number: 2, code: "GER-2" },
  { id: "s3", team_code: "GER", number: 3, code: "GER-3" },
  { id: "s4", team_code: "FRA", number: 1, code: "FRA-1" },
];

// GER-1: owned, 1 duplicate available, listed for trade.
// GER-2: explicitly missing (quantity 0).
// GER-3: unmarked (no row).
// FRA-1: owned, no duplicate, listed for sale with a price.
const USER_STICKERS = [
  { sticker_id: "s1", quantity: 2, listing_type: "trade", price: null },
  { sticker_id: "s2", quantity: 0, listing_type: null, price: null },
  { sticker_id: "s4", quantity: 1, listing_type: "sale", price: 10 },
];

function setupTables() {
  tableMocks.set("teams", chainableRange(TEAMS));
  tableMocks.set("stickers", chainableRange(STICKERS));
  tableMocks.set("user_stickers", chainableRange(USER_STICKERS));
}

describe("getMyCollectionForExport", () => {
  beforeEach(() => {
    tableMocks.clear();
    mockGetUser.mockReset();
    mockFrom.mockClear();
  });

  it("returns null (never an empty array) when there is no authenticated session - the route handler must treat this as unauthorized, not an empty export", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await getMyCollectionForExport("full");
    expect(result).toBeNull();
  });

  it("scopes the user_stickers query to exactly the authenticated caller's own id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    await getMyCollectionForExport("full");

    const userStickersMock = tableMocks.get("user_stickers") as { lastEqArgs?: unknown[] };
    expect(userStickersMock.lastEqArgs).toEqual(["user_id", USER_ID]);
  });

  it("'full' returns every sticker in the catalog, marked or not", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    const rows = await getMyCollectionForExport("full");
    expect(rows).toHaveLength(4);
  });

  it("'owned' returns only stickers with quantity >= 1", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    const rows = await getMyCollectionForExport("owned");
    expect(rows?.map((r) => r.code).sort()).toEqual(["FRA-1", "GER-1"]);
  });

  it("'missing' returns explicitly-missing and unmarked stickers (everything not owned)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    const rows = await getMyCollectionForExport("missing");
    expect(rows?.map((r) => r.code).sort()).toEqual(["GER-2", "GER-3"]);
  });

  it("'duplicates' returns only stickers with at least one available duplicate copy, using the canonical quantity rule (quantity 2 -> 1 duplicate)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    const rows = await getMyCollectionForExport("duplicates");
    expect(rows).toHaveLength(1);
    expect(rows?.[0].code).toBe("GER-1");
    expect(rows?.[0].availableDuplicates).toBe(1);
  });

  it("'for_trade' returns only stickers listed for trade or both", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    const rows = await getMyCollectionForExport("for_trade");
    expect(rows?.map((r) => r.code)).toEqual(["GER-1"]);
  });

  it("'for_sale' returns only stickers listed for sale or both, including their price", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    const rows = await getMyCollectionForExport("for_sale");
    expect(rows?.map((r) => r.code)).toEqual(["FRA-1"]);
    expect(rows?.[0].price).toBe(10);
  });

  it("'team' scoped to a given team code returns only that team's stickers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    const rows = await getMyCollectionForExport("team", "FRA");
    expect(rows?.map((r) => r.code)).toEqual(["FRA-1"]);
  });

  it("produces the expected exported row shape and status labels", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setupTables();

    const rows = await getMyCollectionForExport("full");
    const ger1 = rows?.find((r) => r.code === "GER-1");
    const ger2 = rows?.find((r) => r.code === "GER-2");
    const ger3 = rows?.find((r) => r.code === "GER-3");

    expect(ger1).toEqual({
      code: "GER-1",
      team: "גרמניה",
      number: 1,
      quantityOwned: 2,
      availableDuplicates: 1,
      status: "owned",
      listingType: "trade",
      price: null,
    });
    expect(ger2?.status).toBe("missing");
    expect(ger3?.status).toBe("unmarked");
    expect(ger3?.quantityOwned).toBe(0);
  });
});
