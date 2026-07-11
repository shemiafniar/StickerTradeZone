import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { summarizeQuantities } from "@/lib/collectionStatus";

const { mockFrom, mockRpc, mockGetUser, tableMocks, chainableRange } = vi.hoisted(() => {
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
    // Platform-wide reads are now paginated via fetchAllRows() -> .range() -
    // this builds a chainable mock where .select()/.order()/.eq()/.in()
    // all return itself, terminated by .range(from, to) resolving to the
    // correctly-sliced page of `data` (inclusive `to`, matching Supabase's
    // real .range() semantics) - this must actually slice rather than
    // always return the full array, otherwise a >1000-row test would loop
    // forever (fetchAllRows keeps paging until a page comes back shorter
    // than a full page).
    chainableRange: (data: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = {};
      const chain = () => obj;
      obj.select = vi.fn(chain);
      obj.order = vi.fn(chain);
      obj.eq = vi.fn(chain);
      obj.in = vi.fn(chain);
      obj.range = vi.fn((from: number, to: number) => Promise.resolve({ data: data.slice(from, to + 1), error: null }));
      return obj;
    },
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

    tableMocks.set(
      "profiles",
      chainableRange(quantities.map((_, i) => ({ id: `u${i}`, status: "active", location_enabled: false })))
    );
    tableMocks.set(
      "user_stickers",
      chainableRange(quantities.map((quantity, i) => ({ user_id: `u${i}`, sticker_id: `s${i}`, quantity })))
    );
    tableMocks.set("trade_requests", chainableRange([]));

    const expected = summarizeQuantities(quantities);
    const stats = await getAdminStats();

    expect(stats.totalDuplicates).toBe(expected.duplicateUnique);
    expect(stats.totalMissing).toBe(expected.missingUnique);
    expect(stats.totalDuplicateCopies).toBe(expected.totalDuplicateCopies);
  });

  it("a quantity-1 row (owned, no spare) never counts as a duplicate platform-wide", async () => {
    tableMocks.set("profiles", chainableRange([]));
    tableMocks.set("user_stickers", chainableRange([{ user_id: "u1", sticker_id: "s1", quantity: 1 }]));
    tableMocks.set("trade_requests", chainableRange([]));

    const stats = await getAdminStats();
    expect(stats.totalDuplicates).toBe(0);
    expect(stats.totalDuplicateCopies).toBe(0);
    expect(stats.totalMissing).toBe(0);
  });

  it("pages through more than 1000 user_stickers rows without dropping any - the exact scenario that hid a collector's updated collection from platform-wide admin aggregates", async () => {
    // 1200 rows platform-wide (just over Supabase's default 1000-row cap),
    // including one collector ("late-user") whose rows would have landed
    // entirely past the old, un-paginated cutoff.
    const rows = Array.from({ length: 1195 }, (_, i) => ({ user_id: `u${i}`, sticker_id: `s${i}`, quantity: 1 }));
    rows.push(
      { user_id: "late-user", sticker_id: "s-late-1", quantity: 2 },
      { user_id: "late-user", sticker_id: "s-late-2", quantity: 0 },
      { user_id: "late-user", sticker_id: "s-late-3", quantity: 1 },
      { user_id: "late-user", sticker_id: "s-late-4", quantity: 3 },
      { user_id: "late-user", sticker_id: "s-late-5", quantity: 1 }
    );
    expect(rows.length).toBeGreaterThan(1000);

    tableMocks.set("profiles", chainableRange([]));
    tableMocks.set("user_stickers", chainableRange(rows));
    tableMocks.set("trade_requests", chainableRange([]));

    const expected = summarizeQuantities(rows.map((r) => r.quantity));
    const stats = await getAdminStats();

    expect(stats.totalDuplicates).toBe(expected.duplicateUnique);
    expect(stats.totalMissing).toBe(expected.missingUnique);
    expect(stats.totalDuplicateCopies).toBe(expected.totalDuplicateCopies);
  });
});

/**
 * Root-cause investigation: a collector's numbers can only ever come out
 * as 0/empty in getAdminUsers() via a single mechanism - quantitiesByUser
 * has no entry for that profile's exact `id` (the `?? []` fallback on a
 * Map miss). This test proves that mechanism precisely, using the exact
 * reported production numbers for the affected account (12 user_stickers
 * rows: 1 at quantity 1, 11 at quantity 2 - i.e. 12 owned, 0 missing, 11
 * duplicates, 11 duplicate copies):
 *
 * 1. When a profile's `id` exactly matches its user_stickers.user_id rows
 *    (the correct, expected case), the admin list reports the exact
 *    production numbers - so the aggregation logic itself is not the bug.
 * 2. When a user_stickers row's user_id has NO matching profiles row at
 *    all (e.g. from a second, separate sign-up whose profile row is what
 *    actually appears in the list under the same display name, while the
 *    *other* account is the one that actually built up the collection),
 *    that collection data is - correctly, safely - excluded from every
 *    profile's count rather than being wrongly attributed to any of them,
 *    and getAdminUsers() logs a clear, safe (no PII beyond a UUID),
 *    server-side-only diagnostic identifying exactly which user_id has no
 *    home - this is the concrete signal to check in production logs the
 *    next time this is reported.
 * 3. Two profiles sharing the same display name (the realistic cause of an
 *    admin looking at the wrong "Eyal Afinzar" row) are also flagged.
 */
describe("getAdminUsers() - tracing exactly how a correct collection count could render as 0 (root cause investigation)", () => {
  const REAL_USER_ID = "0dc16840-5e15-4a41-9cc7-9fe4d4946f03";
  // 1 owned/no-spare + 11 owned/1-spare-each = 12 owned, 0 missing, 11
  // duplicate-unique, 11 total duplicate copies - matches the reported
  // production numbers for the affected account exactly.
  const REAL_USER_STICKER_ROWS = [
    { user_id: REAL_USER_ID, sticker_id: "s0", quantity: 1 },
    ...Array.from({ length: 11 }, (_, i) => ({ user_id: REAL_USER_ID, sticker_id: `s${i + 1}`, quantity: 2 })),
  ];

  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tableMocks.clear();
    mockRpc.mockClear();
    mockRpc.mockImplementation(async () => ({ data: [] }));
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("reports the exact production numbers (12 owned / 0 missing / 11 duplicates / 11 copies) when the profile id matches the user_stickers rows", async () => {
    tableMocks.set("profiles", {
      select: vi.fn(() => ({
        then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: REAL_USER_ID, full_name: "Eyal Afinzar", city: "תל אביב יפו", status: "active" }] }),
        order: vi.fn().mockResolvedValue({ data: [{ id: REAL_USER_ID, full_name: "Eyal Afinzar", city: "תל אביב יפו", status: "active" }] }),
      })),
    });
    tableMocks.set("user_stickers", { select: vi.fn().mockResolvedValue({ data: REAL_USER_STICKER_ROWS }) });
    tableMocks.set("trade_requests", { select: vi.fn().mockResolvedValue({ data: [] }) });

    const users = await getAdminUsers();
    const row = users.find((u) => u.id === REAL_USER_ID);

    expect(row).toBeTruthy();
    expect(row!.collectionSize).toBe(12);
    expect(row!.missingCount).toBe(0);
    expect(row!.duplicatesCount).toBe(11);
    expect(row!.duplicateCopies).toBe(11);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("excludes an orphaned user_stickers.user_id (no matching profiles row) from every profile's count instead of misattributing it, and logs a safe server-side warning identifying it", async () => {
    // A *different*, empty profile that happens to render under the same
    // display name as the real account - the exact scenario that makes a
    // real collection look like it "disappeared" in /admin/users: an admin
    // sees "Eyal Afinzar" with 0/0/0/0, while the account that actually
    // holds the 12-row collection (REAL_USER_ID) has no profiles row at
    // all to attach to (e.g. deleted, or never the one actually viewed).
    const EMPTY_LOOKALIKE_ID = "11111111-1111-1111-1111-111111111199";
    tableMocks.set("profiles", {
      select: vi.fn(() => ({
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: [{ id: EMPTY_LOOKALIKE_ID, full_name: "Eyal Afinzar", city: "תל אביב יפו", status: "active" }] }),
        order: vi.fn().mockResolvedValue({
          data: [{ id: EMPTY_LOOKALIKE_ID, full_name: "Eyal Afinzar", city: "תל אביב יפו", status: "active" }],
        }),
      })),
    });
    // The 12 real rows exist and are fetched (proving the data itself is
    // never lost or filtered out at the query level) - they're simply
    // keyed to a user_id with no corresponding profile in this result set.
    tableMocks.set("user_stickers", { select: vi.fn().mockResolvedValue({ data: REAL_USER_STICKER_ROWS }) });
    tableMocks.set("trade_requests", { select: vi.fn().mockResolvedValue({ data: [] }) });

    const users = await getAdminUsers();

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(EMPTY_LOOKALIKE_ID);
    expect(users[0].collectionSize).toBe(0);
    expect(users[0].missingCount).toBe(0);
    expect(users[0].duplicatesCount).toBe(0);
    expect(users[0].duplicateCopies).toBe(0);

    // The concrete, safe diagnostic: identifies the orphaned id directly.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(REAL_USER_ID));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no matching profiles row"));
  });

  it("flags two profiles sharing the same display name as a possible duplicate account", async () => {
    const secondId = "22222222-2222-2222-2222-222222222299";
    tableMocks.set("profiles", {
      select: vi.fn(() => ({
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: [
              { id: REAL_USER_ID, full_name: "Eyal Afinzar", city: "תל אביב יפו", status: "active" },
              { id: secondId, full_name: "Eyal Afinzar", city: "חיפה", status: "active" },
            ],
          }),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: REAL_USER_ID, full_name: "Eyal Afinzar", city: "תל אביב יפו", status: "active" },
            { id: secondId, full_name: "Eyal Afinzar", city: "חיפה", status: "active" },
          ],
        }),
      })),
    });
    tableMocks.set("user_stickers", { select: vi.fn().mockResolvedValue({ data: REAL_USER_STICKER_ROWS }) });
    tableMocks.set("trade_requests", { select: vi.fn().mockResolvedValue({ data: [] }) });

    await getAdminUsers();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Eyal Afinzar"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("duplicate accounts"));
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
    });
    // getAdminUserCollectionDetail's "teams"/"stickers" reads are
    // platform-wide and paginated via fetchAllRows() -> .range(); its
    // "user_stickers" read stays a bare, per-user .eq() (max ~960 rows for
    // one collector, never at risk of the 1000-row cap).
    tableMocks.set("teams", chainableRange([{ code: "GER", name_he: "גרמניה" }]));
    tableMocks.set("stickers", chainableRange([{ id: "s1", team_code: "GER", number: 1, code: "GER-1" }]));
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
    });
  });

  it("does NOT count unmarked stickers (no user_stickers row at all) as missing - only explicit quantity=0 rows count as missing, exactly like the collector's own page", async () => {
    // A 5-sticker catalog, but this collector has only ever marked 2 of
    // them: GER-1 (quantity 2 - owned + 1 duplicate) and GER-2 (quantity 0
    // - explicitly missing). GER-3/4/5 have no row at all - they are
    // *unmarked* (gray), never even looked at, not "missing".
    tableMocks.set("teams", chainableRange([{ code: "GER", name_he: "גרמניה" }]));
    tableMocks.set(
      "stickers",
      chainableRange([
        { id: "s1", team_code: "GER", number: 1, code: "GER-1" },
        { id: "s2", team_code: "GER", number: 2, code: "GER-2" },
        { id: "s3", team_code: "GER", number: 3, code: "GER-3" },
        { id: "s4", team_code: "GER", number: 4, code: "GER-4" },
        { id: "s5", team_code: "GER", number: 5, code: "GER-5" },
      ])
    );
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
    // "profiles" is queried two different ways across this call chain -
    // getAdminUsers() does .select("*").order(...).range(...), while
    // getMatchCountsByUser() (called internally by getAdminUsers()) does
    // .select("id, status").range(...) with no .order() - chainableRange()
    // supports both shapes uniformly since every method just returns the
    // same chainable object until .range() is finally called.
    tableMocks.set("profiles", chainableRange(profileRows));
    tableMocks.set("trade_requests", chainableRange([]));
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
    tableMocks.set("user_stickers", chainableRange(allUserStickerRows()));

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
      tableMocks.set("teams", chainableRange(TEAMS));
      tableMocks.set("stickers", chainableRange(CATALOG));
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
