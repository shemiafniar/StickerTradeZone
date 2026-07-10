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

import { getAdminStats, getAdminUserCollectionDetail } from "@/lib/data/admin";

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
