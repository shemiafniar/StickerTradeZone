import { createClient } from "@/lib/supabase/server";
import type { Profile, TradeRequest, UserDuplicate, UserMissing } from "@/types/database";

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

  const [{ data: profiles }, { data: duplicates }, { data: missing }, { data: trades }] = await Promise.all([
    query,
    supabase.from("user_duplicates").select("user_id"),
    supabase.from("user_missing").select("user_id"),
    supabase.from("trade_requests").select("from_user_id, to_user_id"),
  ]);

  const dupCounts = new Map<string, number>();
  for (const d of (duplicates as Pick<UserDuplicate, "user_id">[]) ?? []) {
    dupCounts.set(d.user_id, (dupCounts.get(d.user_id) ?? 0) + 1);
  }

  const missingCounts = new Map<string, number>();
  for (const m of (missing as Pick<UserMissing, "user_id">[]) ?? []) {
    missingCounts.set(m.user_id, (missingCounts.get(m.user_id) ?? 0) + 1);
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

  const [profiles, duplicates, missing, trades] = await Promise.all([
    supabase.from("profiles").select("status"),
    supabase.from("user_duplicates").select("id", { count: "exact", head: true }),
    supabase.from("user_missing").select("id", { count: "exact", head: true }),
    supabase.from("trade_requests").select("status"),
  ]);

  const profileRows = (profiles.data as { status: string }[]) ?? [];
  const tradeRows = (trades.data as { status: string }[]) ?? [];

  return {
    totalUsers: profileRows.length,
    activeUsers: profileRows.filter((p) => p.status === "active").length,
    suspendedUsers: profileRows.filter((p) => p.status === "suspended").length,
    totalDuplicates: duplicates.count ?? 0,
    totalMissing: missing.count ?? 0,
    totalTradeRequests: tradeRows.length,
    pendingTradeRequests: tradeRows.filter((t) => t.status === "pending").length,
    completedTradeRequests: tradeRows.filter((t) => t.status === "completed").length,
  };
}
