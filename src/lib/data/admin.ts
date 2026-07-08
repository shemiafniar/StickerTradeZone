import { createClient } from "@/lib/supabase/server";
import type { Profile, TradeRequest, UserSticker } from "@/types/database";

export interface AdminUserRow extends Profile {
  duplicatesCount: number;
  missingCount: number;
  tradeRequestsCount: number;
}

export async function getAdminUsers(cityFilter?: string): Promise<AdminUserRow[]> {
  const supabase = await createClient();

  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (cityFilter) {
    query = query.ilike("city", `%${cityFilter}%`);
  }

  const [{ data: profiles }, { data: userStickers }, { data: trades }] = await Promise.all([
    query,
    supabase.from("user_stickers").select("user_id, status"),
    supabase.from("trade_requests").select("from_user_id, to_user_id"),
  ]);

  const dupCounts = new Map<string, number>();
  const missingCounts = new Map<string, number>();
  for (const row of (userStickers as Pick<UserSticker, "user_id" | "status">[]) ?? []) {
    const map = row.status === "duplicate" ? dupCounts : row.status === "missing" ? missingCounts : null;
    if (map) map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1);
  }

  const tradeCounts = new Map<string, number>();
  for (const t of (trades as Pick<TradeRequest, "from_user_id" | "to_user_id">[]) ?? []) {
    tradeCounts.set(t.from_user_id, (tradeCounts.get(t.from_user_id) ?? 0) + 1);
    tradeCounts.set(t.to_user_id, (tradeCounts.get(t.to_user_id) ?? 0) + 1);
  }

  return ((profiles as Profile[]) ?? []).map((p) => ({
    ...p,
    duplicatesCount: dupCounts.get(p.id) ?? 0,
    missingCount: missingCounts.get(p.id) ?? 0,
    tradeRequestsCount: tradeCounts.get(p.id) ?? 0,
  }));
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalDuplicates: number;
  totalMissing: number;
  totalTradeRequests: number;
  pendingTradeRequests: number;
  completedTradeRequests: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();

  const [profiles, userStickers, trades] = await Promise.all([
    supabase.from("profiles").select("status"),
    supabase.from("user_stickers").select("status"),
    supabase.from("trade_requests").select("status"),
  ]);

  const profileRows = (profiles.data as { status: string }[]) ?? [];
  const stickerRows = (userStickers.data as Pick<UserSticker, "status">[]) ?? [];
  const tradeRows = (trades.data as { status: string }[]) ?? [];

  return {
    totalUsers: profileRows.length,
    activeUsers: profileRows.filter((p) => p.status === "active").length,
    suspendedUsers: profileRows.filter((p) => p.status === "suspended").length,
    totalDuplicates: stickerRows.filter((s) => s.status === "duplicate").length,
    totalMissing: stickerRows.filter((s) => s.status === "missing").length,
    totalTradeRequests: tradeRows.length,
    pendingTradeRequests: tradeRows.filter((t) => t.status === "pending").length,
    completedTradeRequests: tradeRows.filter((t) => t.status === "completed").length,
  };
}
