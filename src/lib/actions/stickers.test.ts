import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { mockGetUser, mockFrom, tableMocks } = vi.hoisted(() => {
  const tableMocks = new Map<string, unknown>();
  return {
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
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock("@/lib/data/stickers", () => ({
  getStickerCodeToIdMap: vi.fn(async () => new Map([["GER-1", "sticker-ger-1"]])),
}));

import { saveTeamGridAction, saveScannedStickersAsOwnedAction } from "@/lib/actions/stickers";

const USER = { id: "11111111-1111-1111-1111-111111111101" };

describe("saveTeamGridAction", () => {
  let upsertSpy: ReturnType<typeof vi.fn>;
  let deleteEqSpy: ReturnType<typeof vi.fn>;
  let deleteInSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetUser.mockReset();
    tableMocks.clear();
    mockGetUser.mockResolvedValue({ data: { user: USER } });

    upsertSpy = vi.fn().mockResolvedValue({ error: null });
    deleteInSpy = vi.fn().mockResolvedValue({ error: null });
    deleteEqSpy = vi.fn().mockReturnValue({ in: deleteInSpy });

    tableMocks.set("user_stickers", {
      upsert: upsertSpy,
      delete: vi.fn().mockReturnValue({ eq: deleteEqSpy }),
    });
  });

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await saveTeamGridAction("GER", [{ stickerId: "s1", quantity: 1 }]);
    expect(result.error).toBeTruthy();
  });

  it("upserts non-null quantities (including explicit 0 = missing) and deletes null (unmarked) cells", async () => {
    const cells = [
      { stickerId: "s1", quantity: 1 }, // owned
      { stickerId: "s2", quantity: 3 }, // owned + 2 duplicates
      { stickerId: "s3", quantity: 0 }, // explicit missing
      { stickerId: "s4", quantity: null }, // unmarked - deleted
    ];

    const result = await saveTeamGridAction("GER", cells);

    expect(result.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalledWith(
      [
        { user_id: USER.id, sticker_id: "s1", quantity: 1 },
        { user_id: USER.id, sticker_id: "s2", quantity: 3 },
        { user_id: USER.id, sticker_id: "s3", quantity: 0 },
      ],
      { onConflict: "user_id,sticker_id" }
    );
    expect(deleteInSpy).toHaveBeenCalledWith("sticker_id", ["s4"]);
  });

  it("skips the upsert call entirely when every cell is unmarked", async () => {
    const result = await saveTeamGridAction("GER", [{ stickerId: "s1", quantity: null }]);
    expect(result.success).toBe(true);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(deleteInSpy).toHaveBeenCalledWith("sticker_id", ["s1"]);
  });

  it("surfaces a database error instead of reporting success", async () => {
    upsertSpy.mockResolvedValue({ error: { message: "db exploded" } });
    const result = await saveTeamGridAction("GER", [{ stickerId: "s1", quantity: 1 }]);
    expect(result.error).toBe("db exploded");
    expect(result.success).toBeUndefined();
  });
});

describe("saveScannedStickersAsOwnedAction", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    tableMocks.clear();
    mockGetUser.mockResolvedValue({ data: { user: USER } });
  });

  it("sets quantity to 1 for a newly-scanned sticker with no existing row", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    tableMocks.set("user_stickers", {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [] }),
      upsert: upsertSpy,
    });

    const result = await saveScannedStickersAsOwnedAction(["GER-1"]);

    expect(result.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalledWith([{ user_id: USER.id, sticker_id: "sticker-ger-1", quantity: 1 }], {
      onConflict: "user_id,sticker_id",
    });
  });

  it("never reduces an existing quantity >= 1 (owning spares is a stronger signal than a plain scan)", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    tableMocks.set("user_stickers", {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ sticker_id: "sticker-ger-1", quantity: 3 }] }),
      upsert: upsertSpy,
    });

    const result = await saveScannedStickersAsOwnedAction(["GER-1"]);

    expect(result.success).toBe(true);
    expect(result.addedCount).toBe(0);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("upgrades an explicit quantity 0 (missing) row to owned (quantity 1)", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    tableMocks.set("user_stickers", {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ sticker_id: "sticker-ger-1", quantity: 0 }] }),
      upsert: upsertSpy,
    });

    const result = await saveScannedStickersAsOwnedAction(["GER-1"]);

    expect(result.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalledWith([{ user_id: USER.id, sticker_id: "sticker-ger-1", quantity: 1 }], {
      onConflict: "user_id,sticker_id",
    });
  });
});
