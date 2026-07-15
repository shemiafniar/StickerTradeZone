import { describe, expect, it, vi } from "vitest";
import { resolveNotificationTarget } from "@/lib/notifications/resolveTarget";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const USER_ID = "11111111-1111-1111-1111-111111111101";
const OTHER_USER_ID = "11111111-1111-1111-1111-111111111102";
const TRADE_ID = "22222222-2222-2222-2222-222222222201";
const VALID_LINK = `/dashboard/trades/${TRADE_ID}`;

function makeSupabase(tradeRow: { id: string; from_user_id: string; to_user_id: string } | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: tradeRow }),
    })),
  } as unknown as SupabaseClient<Database>;
}

describe("resolveNotificationTarget", () => {
  it("resolves a valid trade link when the trade exists and the caller is a participant (sender)", async () => {
    const supabase = makeSupabase({ id: TRADE_ID, from_user_id: USER_ID, to_user_id: OTHER_USER_ID });
    const result = await resolveNotificationTarget(supabase, { link: VALID_LINK }, USER_ID);
    expect(result).toBe(VALID_LINK);
  });

  it("resolves a valid trade link when the caller is a participant (recipient)", async () => {
    const supabase = makeSupabase({ id: TRADE_ID, from_user_id: OTHER_USER_ID, to_user_id: USER_ID });
    const result = await resolveNotificationTarget(supabase, { link: VALID_LINK }, USER_ID);
    expect(result).toBe(VALID_LINK);
  });

  it("falls back to null for a null link", async () => {
    const supabase = makeSupabase(null);
    const result = await resolveNotificationTarget(supabase, { link: null }, USER_ID);
    expect(result).toBeNull();
  });

  it("falls back to null for a malformed link (not a trade path)", async () => {
    const supabase = makeSupabase({ id: TRADE_ID, from_user_id: USER_ID, to_user_id: OTHER_USER_ID });
    const result = await resolveNotificationTarget(supabase, { link: "/dashboard/trades/not-a-uuid" }, USER_ID);
    expect(result).toBeNull();
  });

  it("falls back to null for an unsupported link shape (different route entirely)", async () => {
    const supabase = makeSupabase({ id: TRADE_ID, from_user_id: USER_ID, to_user_id: OTHER_USER_ID });
    const result = await resolveNotificationTarget(supabase, { link: "/dashboard/matches" }, USER_ID);
    expect(result).toBeNull();
  });

  it("falls back to null for an unsafe, protocol-relative link", async () => {
    const supabase = makeSupabase({ id: TRADE_ID, from_user_id: USER_ID, to_user_id: OTHER_USER_ID });
    const result = await resolveNotificationTarget(supabase, { link: "//evil.example.com" }, USER_ID);
    expect(result).toBeNull();
  });

  it("falls back to null for an unsafe absolute URL", async () => {
    const supabase = makeSupabase({ id: TRADE_ID, from_user_id: USER_ID, to_user_id: OTHER_USER_ID });
    const result = await resolveNotificationTarget(
      supabase,
      { link: "https://evil.example.com/dashboard/trades/" + TRADE_ID },
      USER_ID
    );
    expect(result).toBeNull();
  });

  it("falls back to null when the referenced trade no longer exists (deleted)", async () => {
    const supabase = makeSupabase(null);
    const result = await resolveNotificationTarget(supabase, { link: VALID_LINK }, USER_ID);
    expect(result).toBeNull();
  });

  it("falls back to null when the trade exists but the caller is no longer a participant (inaccessible)", async () => {
    const supabase = makeSupabase({ id: TRADE_ID, from_user_id: OTHER_USER_ID, to_user_id: "some-third-user" });
    const result = await resolveNotificationTarget(supabase, { link: VALID_LINK }, USER_ID);
    expect(result).toBeNull();
  });
});
