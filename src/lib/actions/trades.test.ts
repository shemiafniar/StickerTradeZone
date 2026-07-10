import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { mockRedirect, mockGetUser, mockRpc, mockFrom, tableMocks } = vi.hoisted(() => {
  const tableMocks = new Map<string, unknown>();
  return {
    mockRedirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    }),
    mockGetUser: vi.fn(),
    mockRpc: vi.fn(),
    mockFrom: vi.fn((table: string) => {
      const impl = tableMocks.get(table);
      if (!impl) throw new Error(`No mock registered for table "${table}"`);
      return impl;
    }),
    tableMocks,
  };
});

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

const { CODE_TO_ID } = vi.hoisted(() => ({
  CODE_TO_ID: new Map<string, string>([
    ["GER-1", "sticker-ger-1"],
    ["GER-2", "sticker-ger-2"],
    ["FRA-5", "sticker-fra-5"],
  ]),
}));
vi.mock("@/lib/data/stickers", () => ({
  getStickerCodeToIdMap: vi.fn(async () => CODE_TO_ID),
}));

vi.mock("@/lib/rateLimit", () => ({ formatRetrySeconds: vi.fn(() => "כמה דקות") }));

import { createTradeRequestAction } from "@/lib/actions/trades";

const SENDER = { id: "11111111-1111-1111-1111-111111111101" };
const RECIPIENT_ID = "22222222-2222-2222-2222-222222222202";

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Builds a table-name-scoped mock matching the query-builder shapes trades.ts actually uses. */
function setupTables(opts: {
  senderProfile?: { status: string };
  targetProfile?: { status: string } | null;
  recentTradeCount?: number;
  myStickerQuantities?: Record<string, number>;
  insertTradeResult?: { data: { id: string } | null; error: unknown };
  insertItemsError?: unknown;
}) {
  const {
    senderProfile = { status: "active" },
    targetProfile = { status: "active" },
    recentTradeCount = 0,
    myStickerQuantities = {},
    insertTradeResult = { data: { id: "trade-1" }, error: null },
    insertItemsError = null,
  } = opts;

  tableMocks.set("profiles", {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((col: string, val: string) => {
      const profile = val === SENDER.id ? senderProfile : targetProfile;
      return {
        maybeSingle: vi.fn().mockResolvedValue({ data: profile }),
        gte: vi.fn().mockResolvedValue({ count: recentTradeCount }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    }),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  });

  tableMocks.set("trade_requests", {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ count: recentTradeCount }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(insertTradeResult) }),
    }),
  });

  tableMocks.set("trade_request_items", {
    insert: vi.fn().mockResolvedValue({ error: insertItemsError }),
  });

  tableMocks.set("user_stickers", {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({
      data: Object.entries(myStickerQuantities).map(([code, quantity]) => ({
        sticker_id: CODE_TO_ID.get(code),
        quantity,
      })),
    }),
  });
}

describe("createTradeRequestAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockRedirect.mockClear();
    tableMocks.clear();
    mockGetUser.mockResolvedValue({ data: { user: SENDER } });
  });

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, give: "GER-1" }));
    expect(result?.error).toBeTruthy();
  });

  it("rejects when the sender is suspended", async () => {
    setupTables({ senderProfile: { status: "suspended" } });
    const result = await createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, give: "GER-1" }));
    expect(result?.error).toMatch(/מושהה/);
  });

  it("rejects when the target user isn't active", async () => {
    setupTables({ targetProfile: { status: "suspended" } });
    const result = await createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, give: "GER-1" }));
    expect(result?.error).toBeTruthy();
  });

  it("rejects when the rate limit is exceeded", async () => {
    setupTables({ recentTradeCount: 20 });
    const result = await createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, give: "GER-1" }));
    expect(result?.error).toMatch(/יותר מדי בקשות/);
  });

  it("rejects an empty give/receive submission", async () => {
    setupTables({});
    const result = await createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID }));
    expect(result?.error).toBeTruthy();
  });

  it("rejects offering a sticker with no available duplicate (quantity 1 - owned, no spare)", async () => {
    setupTables({ myStickerQuantities: { "GER-1": 1 } });
    const result = await createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, give: "GER-1" }));
    expect(result?.error).toMatch(/אין לך כפולות זמינות/);
    expect(result?.error).toContain("GER-1");
  });

  it("rejects offering a sticker the sender doesn't have at all (quantity 0/missing)", async () => {
    setupTables({ myStickerQuantities: { "GER-1": 0 } });
    const result = await createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, give: "GER-1" }));
    expect(result?.error).toMatch(/אין לך כפולות זמינות/);
  });

  it("rejects if even one of several offered stickers lacks an available duplicate", async () => {
    setupTables({ myStickerQuantities: { "GER-1": 3, "GER-2": 1 } });
    const result = await createTradeRequestAction(
      {},
      makeForm({ toUserId: RECIPIENT_ID, give: "GER-1, GER-2" })
    );
    expect(result?.error).toMatch(/GER-2/);
  });

  it("allows offering a sticker with quantity 2 (exactly one available duplicate)", async () => {
    setupTables({ myStickerQuantities: { "GER-1": 2 } });
    await expect(
      createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, give: "GER-1" }))
    ).rejects.toThrow("REDIRECT:/dashboard/trades/trade-1");
  });

  it("creates the trade and redirects when every give-item has an available duplicate", async () => {
    setupTables({ myStickerQuantities: { "GER-1": 3 } });
    await expect(
      createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, give: "GER-1", receive: "FRA-5" }))
    ).rejects.toThrow("REDIRECT:/dashboard/trades/trade-1");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/trades/trade-1");
  });

  it("never validates duplicate availability for receive-only requests (nothing of mine is being given away)", async () => {
    setupTables({ myStickerQuantities: {} });
    await expect(
      createTradeRequestAction({}, makeForm({ toUserId: RECIPIENT_ID, receive: "FRA-5" }))
    ).rejects.toThrow("REDIRECT:/dashboard/trades/trade-1");
  });
});
