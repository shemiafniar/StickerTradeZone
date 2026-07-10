import { describe, expect, it, vi, beforeEach } from "vitest";
import { summarizeQuantities } from "@/lib/collectionStatus";

const { mockFrom, mockRpc, mockGetUser, tableMocks } = vi.hoisted(() => {
  const tableMocks = new Map<string, unknown>();
  return {
    mockRpc: vi.fn(async () => ({ data: [] })),
    mockGetUser: vi.fn(),
    mockFrom: vi.fn((table: string) => {
      const impl = tableMocks.get(table);
      if (!impl) throw new Error(`No mock registered for table "${table}"`);
      return impl;
    }),
    tableMocks,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom, rpc: mockRpc, auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/data/stickers", () => ({
  getStickerIdToCodeMap: vi.fn(async () => new Map()),
}));

import { getAdminStats, getAdminUserCollectionDetail, getAdminUsers } from "@/lib/data/admin";

/**
 * Requirement #4 ("fix synchronization between collector data and admin
 * statistics"): getAdminStats() must derive its duplicate/missing counts
 * from the exact same summarizeQuantities() helper the user-facing
 * collection page (getCollectionCounts) uses - never a parallel
 * calculation that could silently drift. This test proves that property
 * directly: feed the same raw quantity rows into both summarizeQuantities()
 * (the canonical rule) and getAdminStats() (the admin-facing aggregate),
 * and assert the numbers are identical.
 */
describe("getAdminStats uses the canonical collectionStatus rules (no parallel calculation)", () => {
  beforeEach(() => {
    tableMocks.clear();
    mockRpc.mockClear();
  });

  it("totalDuplicates/totalMissing/totalDuplicateCopies exactly match summarizeQuantities() on the same raw rows", async () => {
    // A realistic, mixed platform-wide set of (user, sticker) quantities.
    const quantities = [0, 0, 0, 1, 1, 2, 2, 3, 5, 0];

    tableMocks.set("profiles", {
      select: vi.fn().mockResolvedValue({
        data: quantities.map((_, i) => ({ id: `u${i}`, status: "active", location_enabled: false })),
      }),
    });
    tableMocks.set("user_stickers", {
      select: vi.fn().mockResolvedValue({
        data: quantities.map((quantity, i) => ({ user_id: `u${i}`, sticker_id: `s${i}`, quantity })),
      }),
    });
    tableMocks.set("trade_requests", {
      select: vi.fn().mockResolvedValue({ data: [] }),
    });

    const expected = summarizeQuantities(quantities);
    const stats = await getAdminStats();

    expect(stats.totalDuplicates).toBe(expected.duplicateUnique);
    expect(stats.totalMissing).toBe(expected.missingUnique);
    expect(stats.totalDuplicateCopies).toBe(expected.totalDuplicateCopies);
  });

  it("a quantity-1 row (owned, no spare) never counts as a duplicate platform-wide", async () => {
    tableMocks.set("profiles", { select: vi.fn().mockResolvedValue({ data: [] }) });
    tableMocks.set("user_stickers", {
      select: vi.fn().mockResolvedValue({ data: [{ user_id: "u1", sticker_id: "s1", quantity: 1 }] }),
    });
    tableMocks.set("trade_requests", { select: vi.fn().mockResolvedValue({ data: [] }) });

    const stats = await getAdminStats();
    expect(stats.totalDuplicates).toBe(0);
    expect(stats.totalDuplicateCopies).toBe(0);
    expect(stats.totalMissing).toBe(0);
  });
});

describe("getAdminUserCollectionDetail authorization (requirement: admin-only, blocked for non-admins)", () => {
  beforeEach(() => {
    tableMocks.clear();
    mockGetUser.mockReset();
  });

  it("throws when logged out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(getAdminUserCollectionDetail("some-user-id")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws when the caller is authenticated but not an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "regular-user" } } });
    tableMocks.set("profiles", {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "user" } }),
    });

    await expect(getAdminUserCollectionDetail("some-user-id")).rejects.toThrow("FORBIDDEN");
  });

  it("succeeds and returns a full breakdown for an authenticated admin caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-user" } } });
    tableMocks.set("profiles", {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
      order: vi.fn().mockReturnThis(),
    });
    // getAdminUserCollectionDetail's own three parallel queries reuse the
    // same "profiles"-shaped builder object above for .from("teams") calls
    // too via a distinct table key - register them explicitly.
    tableMocks.set("teams", {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) => resolve({ data: [{ code: "GER", name_he: "גרמניה" }] }),
    });
    tableMocks.set("stickers", {
      select: vi.fn().mockResolvedValue({ data: [{ id: "s1", team_code: "GER", number: 1, code: "GER-1" }] }),
    });
    tableMocks.set("user_stickers", {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ sticker_id: "s1", quantity: 2, listing_type: "trade", price: null }] }),
    });

    const detail = await getAdminUserCollectionDetail("some-user-id");
    expect(detail.ownedUnique).toBe(1);
    expect(detail.duplicateUnique).toBe(1);
    expect(detail.stickers[0].code).toBe("GER-1");
  });
});

describe("getAdminUserCollectionDetail matches the same canonical rules as getCollectionCounts/getAdminUsers (sync regression guard)", () => {
  beforeEach(() => {
    tableMocks.clear();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-user" } } });
    tableMocks.set("profiles", {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
      order: vi.fn().mockReturnThis(),
    });
  });

  it("does NOT count unmarked stickers (no user_stickers row at all) as missing - only explicit quantity=0 rows count as missing, exactly like the collector's own page", async () => {
    // A 5-sticker catalog, but this collector has only ever marked 2 of
    // them: GER-1 (quantity 2 - owned + 1 duplicate) and GER-2 (quantity 0
    // - explicitly missing). GER-3/4/5 have no row at all - they are
    // *unmarked* (gray), never even looked at, not "missing".
    tableMocks.set("teams", {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) => resolve({ data: [{ code: "GER", name_he: "גרמניה" }] }),
    });
    tableMocks.set("stickers", {
      select: vi.fn().mockResolvedValue({
        data: [
          { id: "s1", team_code: "GER", number: 1, code: "GER-1" },
          { id: "s2", team_code: "GER", number: 2, code: "GER-2" },
          { id: "s3", team_code: "GER", number: 3, code: "GER-3" },
          { id: "s4", team_code: "GER", number: 4, code: "GER-4" },
          { id: "s5", team_code: "GER", number: 5, code: "GER-5" },
        ],
      }),
    });
    tableMocks.set("user_stickers", {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { sticker_id: "s1", quantity: 2, listing_type: "trade", price: null },
          { sticker_id: "s2", quantity: 0, listing_type: "trade", price: null },
        ],
      }),
    });

    const detail = await getAdminUserCollectionDetail("some-user-id");

    // Same numbers a getCollectionCounts()/getAdminUsers() call over this
    // exact same underlying data (2 rows: quantity 2 and quantity 0) would
    // produce - i.e. summarizeQuantities([2, 0]).
    expect(detail.ownedUnique).toBe(1);
    expect(detail.missingUnique).toBe(1); // only GER-2 - NOT GER-3/4/5
    expect(detail.duplicateUnique).toBe(1);
    expect(detail.totalDuplicateCopies).toBe(1);

    // The per-team breakdown must be internally consistent with the
    // overall numbers too (they're the same team here).
    expect(detail.teams[0].missing).toBe(1);
    expect(detail.teams[0].owned).toBe(1);

    // The full sticker table may still legitimately show the whole
    // catalog (a reasonable admin audit view) - but unmarked stickers
    // must be labeled distinctly from an explicit missing mark.
    const unmarked = detail.stickers.find((s) => s.code === "GER-3");
    const explicitlyMissing = detail.stickers.find((s) => s.code === "GER-2");
    expect(unmarked?.state).toBe("none");
    expect(explicitlyMissing?.state).toBe("missing");
  });
});

/**
 * Multi-user validation (explicitly required): a two-team, 10-sticker
 * catalog and four collectors with very different collection shapes -
 * an admin with a near-complete collection, a regular user with a small
 * partial collection (mirroring the "Eyal Afinzar" report - a handful of
 * marks in a mostly-unmarked catalog), a regular user with nothing marked
 * at all, and a regular user with the entire catalog marked. For every one
 * of them, getAdminUsers() (the admin list) and getAdminUserCollectionDetail()
 * (the admin per-user detail page) must report the exact same
 * owned/missing/duplicate/duplicateCopies numbers as summarizeQuantities()
 * computed directly from that user's own raw rows (i.e. what the
 * collector's own getCollectionCounts() would show) - proving the three
 * surfaces can never disagree, for any collector regardless of role or
 * collection size.
 */
describe("Collector, admin list, and admin detail agree for every user (multi-user, cross-surface sync)", () => {
  const CATALOG = [
    { id: "s-ger-1", team_code: "GER", number: 1, code: "GER-1" },
    { id: "s-ger-2", team_code: "GER", number: 2, code: "GER-2" },
    { id: "s-ger-3", team_code: "GER", number: 3, code: "GER-3" },
    { id: "s-ger-4", team_code: "GER", number: 4, code: "GER-4" },
    { id: "s-ger-5", team_code: "GER", number: 5, code: "GER-5" },
    { id: "s-fra-1", team_code: "FRA", number: 1, code: "FRA-1" },
    { id: "s-fra-2", team_code: "FRA", number: 2, code: "FRA-2" },
    { id: "s-fra-3", team_code: "FRA", number: 3, code: "FRA-3" },
    { id: "s-fra-4", team_code: "FRA", number: 4, code: "FRA-4" },
    { id: "s-fra-5", team_code: "FRA", number: 5, code: "FRA-5" },
  ];
  const TEAMS = [
    { code: "GER", name_he: "גרמניה" },
    { code: "FRA", name_he: "צרפת" },
  ];

  // (user_id, sticker_id, quantity) rows actually stored per collector -
  // never padded with the rest of the catalog (that's the bug being
  // guarded against).
  const ROWS_BY_USER: Record<string, { sticker_id: string; quantity: number }[]> = {
    "admin-1": [
      { sticker_id: "s-ger-1", quantity: 1 },
      { sticker_id: "s-ger-2", quantity: 1 },
      { sticker_id: "s-ger-3", quantity: 3 },
      { sticker_id: "s-ger-4", quantity: 1 },
      { sticker_id: "s-fra-1", quantity: 2 },
      { sticker_id: "s-fra-2", quantity: 1 },
      { sticker_id: "s-fra-3", quantity: 1 },
      { sticker_id: "s-fra-4", quantity: 0 },
      // s-ger-5 / s-fra-5 left unmarked
    ],
    "eyal-partial": [
      { sticker_id: "s-ger-1", quantity: 2 },
      { sticker_id: "s-fra-1", quantity: 0 },
      // everything else (8 of 10 stickers) unmarked - mirrors the report
    ],
    "empty-user": [],
    "full-user": CATALOG.map((s, i) => ({ sticker_id: s.id, quantity: i % 4 === 0 ? 0 : (i % 3) + 1 })),
  };

  const ROLE_BY_USER: Record<string, "admin" | "user"> = {
    "admin-1": "admin",
    "eyal-partial": "user",
    "empty-user": "user",
    "full-user": "user",
  };

  function allUserStickerRows() {
    return Object.entries(ROWS_BY_USER).flatMap(([userId, rows]) => rows.map((r) => ({ user_id: userId, ...r })));
  }

  function setupSharedTables() {
    const profileRows = Object.keys(ROWS_BY_USER).map((id) => ({
      id,
      full_name: id,
      city: "תל אביב יפו",
      role: ROLE_BY_USER[id],
      status: "active",
      location_enabled: false,
      created_at: "2026-01-01T00:00:00Z",
    }));
    // "profiles" is queried two different ways across this call chain:
    // getAdminUsers() does .select("*").order(...), while
    // getMatchCountsByUser() (called internally by getAdminUsers()) does a
    // bare .select("id, status") with no further chaining, awaited
    // directly - so this mock's .select() return value must itself be
    // awaitable (via .then) *and* expose .order() for the other call site.
    tableMocks.set("profiles", {
      select: vi.fn(() => ({
        then: (resolve: (v: unknown) => void) => resolve({ data: profileRows }),
        order: vi.fn().mockResolvedValue({ data: profileRows }),
      })),
    });
    tableMocks.set("trade_requests", { select: vi.fn().mockResolvedValue({ data: [] }) });
  }

  beforeEach(() => {
    tableMocks.clear();
    mockRpc.mockClear();
    mockGetUser.mockReset();
  });

  it("getAdminUsers() matches summarizeQuantities() on each user's own raw rows, for every user regardless of role or collection size", async () => {
    setupSharedTables();
    mockRpc.mockImplementation(async (name: string) => {
      if (name === "admin_get_user_emails") return { data: [] };
      return { data: [] };
    });
    tableMocks.set("user_stickers", { select: vi.fn().mockResolvedValue({ data: allUserStickerRows() }) });

    const users = await getAdminUsers();
    expect(users).toHaveLength(4);

    for (const userId of Object.keys(ROWS_BY_USER)) {
      const expected = summarizeQuantities(ROWS_BY_USER[userId].map((r) => r.quantity));
      const row = users.find((u) => u.id === userId);
      expect(row, `admin list row for ${userId}`).toBeTruthy();
      expect(row!.collectionSize, `${userId} collectionSize`).toBe(expected.ownedUnique);
      expect(row!.missingCount, `${userId} missingCount`).toBe(expected.missingUnique);
      expect(row!.duplicatesCount, `${userId} duplicatesCount`).toBe(expected.duplicateUnique);
      expect(row!.duplicateCopies, `${userId} duplicateCopies`).toBe(expected.totalDuplicateCopies);
    }
  });

  it("getAdminUserCollectionDetail() matches summarizeQuantities() on each user's own raw rows, for every user regardless of role or collection size", async () => {
    for (const userId of Object.keys(ROWS_BY_USER)) {
      tableMocks.clear();
      mockGetUser.mockResolvedValue({ data: { user: { id: "some-admin-viewer" } } });
      tableMocks.set("profiles", {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
      });
      tableMocks.set("teams", {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ data: TEAMS }),
      });
      tableMocks.set("stickers", { select: vi.fn().mockResolvedValue({ data: CATALOG }) });
      tableMocks.set("user_stickers", {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: ROWS_BY_USER[userId] }),
      });

      const expected = summarizeQuantities(ROWS_BY_USER[userId].map((r) => r.quantity));
      const detail = await getAdminUserCollectionDetail(userId);

      expect(detail.ownedUnique, `${userId} ownedUnique`).toBe(expected.ownedUnique);
      expect(detail.missingUnique, `${userId} missingUnique`).toBe(expected.missingUnique);
      expect(detail.duplicateUnique, `${userId} duplicateUnique`).toBe(expected.duplicateUnique);
      expect(detail.totalDuplicateCopies, `${userId} totalDuplicateCopies`).toBe(expected.totalDuplicateCopies);

      // Per-team numbers must sum back up to the same overall numbers -
      // internal consistency within the detail page itself.
      const summedMissing = detail.teams.reduce((sum, t) => sum + t.missing, 0);
      const summedOwned = detail.teams.reduce((sum, t) => sum + t.owned, 0);
      expect(summedMissing, `${userId} teams[].missing sum`).toBe(expected.missingUnique);
      expect(summedOwned, `${userId} teams[].owned sum`).toBe(expected.ownedUnique);
    }
  });
});
