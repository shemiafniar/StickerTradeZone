import { createClient } from "@/lib/supabase/server";
import { getStickerIdToCodeMap } from "@/lib/data/stickers";
import type { Profile, TradeRequest, TradeRequestItem, UserSticker } from "@/types/database";

// ============================================================================
// Users management
// ============================================================================

export interface AdminUserRow extends Profile {
  email: string | null;
  duplicatesCount: number;
  missingCount: number;
  /** Stickers actually owned (have + duplicate) - "collection size". */
  collectionSize: number;
  tradeRequestsCount: number;
  /** How many other collectors this user has an active (mutual, non-zero) match with. */
  matchesCount: number;
}

/** Case-insensitive search across name, email, and city - beta-scale, so filtering client-side after one fetch is fine. */
export async function getAdminUsers(searchTerm?: string): Promise<AdminUserRow[]> {
  const supabase = await createClient();

  const [{ data: profiles }, { data: userStickers }, { data: trades }, { data: emailRows }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("user_stickers").select("user_id, status"),
    supabase.from("trade_requests").select("from_user_id, to_user_id"),
    supabase.rpc("admin_get_user_emails"),
  ]);

  const emailByUserId = new Map(((emailRows as { id: string; email: string | null }[]) ?? []).map((r) => [r.id, r.email]));

  const dupCounts = new Map<string, number>();
  const missingCounts = new Map<string, number>();
  const ownedCounts = new Map<string, number>();
  for (const row of (userStickers as Pick<UserSticker, "user_id" | "status">[]) ?? []) {
    if (row.status === "duplicate") {
      dupCounts.set(row.user_id, (dupCounts.get(row.user_id) ?? 0) + 1);
      ownedCounts.set(row.user_id, (ownedCounts.get(row.user_id) ?? 0) + 1);
    } else if (row.status === "missing") {
      missingCounts.set(row.user_id, (missingCounts.get(row.user_id) ?? 0) + 1);
    } else if (row.status === "have") {
      ownedCounts.set(row.user_id, (ownedCounts.get(row.user_id) ?? 0) + 1);
    }
  }

  const tradeCounts = new Map<string, number>();
  for (const t of (trades as Pick<TradeRequest, "from_user_id" | "to_user_id">[]) ?? []) {
    tradeCounts.set(t.from_user_id, (tradeCounts.get(t.from_user_id) ?? 0) + 1);
    tradeCounts.set(t.to_user_id, (tradeCounts.get(t.to_user_id) ?? 0) + 1);
  }

  const matchCountByUser = await getMatchCountsByUser();

  let rows = ((profiles as Profile[]) ?? []).map((p) => ({
    ...p,
    email: emailByUserId.get(p.id) ?? null,
    duplicatesCount: dupCounts.get(p.id) ?? 0,
    missingCount: missingCounts.get(p.id) ?? 0,
    collectionSize: ownedCounts.get(p.id) ?? 0,
    tradeRequestsCount: tradeCounts.get(p.id) ?? 0,
    matchesCount: matchCountByUser.get(p.id) ?? 0,
  }));

  const term = searchTerm?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (u) =>
        u.full_name.toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term) ||
        u.city.toLowerCase().includes(term)
    );
  }

  return rows;
}

export async function getAdminUserById(userId: string): Promise<AdminUserRow | null> {
  const users = await getAdminUsers();
  return users.find((u) => u.id === userId) ?? null;
}

// ============================================================================
// Dashboard stats
// ============================================================================

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  usersWithLocation: number;
  totalDuplicates: number;
  totalMissing: number;
  totalTradeRequests: number;
  pendingTradeRequests: number;
  completedTradeRequests: number;
  totalMatches: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();

  const [profiles, userStickers, trades, matchCounts] = await Promise.all([
    supabase.from("profiles").select("status, location_enabled"),
    supabase.from("user_stickers").select("status"),
    supabase.from("trade_requests").select("status"),
    getMatchCountsByUser(),
  ]);

  const profileRows = (profiles.data as { status: string; location_enabled: boolean }[]) ?? [];
  const stickerRows = (userStickers.data as Pick<UserSticker, "status">[]) ?? [];
  const tradeRows = (trades.data as { status: string }[]) ?? [];

  // Every mutual match is counted once per participant by getMatchCountsByUser(),
  // so summing and halving gives the number of distinct matching pairs.
  const totalMatches = Array.from(matchCounts.values()).reduce((sum, n) => sum + n, 0) / 2;

  return {
    totalUsers: profileRows.length,
    activeUsers: profileRows.filter((p) => p.status === "active").length,
    suspendedUsers: profileRows.filter((p) => p.status === "suspended").length,
    usersWithLocation: profileRows.filter((p) => p.location_enabled).length,
    totalDuplicates: stickerRows.filter((s) => s.status === "duplicate").length,
    totalMissing: stickerRows.filter((s) => s.status === "missing").length,
    totalTradeRequests: tradeRows.length,
    pendingTradeRequests: tradeRows.filter((t) => t.status === "pending").length,
    completedTradeRequests: tradeRows.filter((t) => t.status === "completed").length,
    totalMatches,
  };
}

/**
 * For each active user, counts how many *other* active users they have a
 * mutual, non-zero match with (same set-intersection rule as
 * computeMatches() in matching.ts, simplified to a boolean/count - the
 * admin dashboard only needs "how many", not ranking). Every qualifying
 * pair is counted once for each side, by design - getAdminStats() halves
 * the sum to get the number of distinct pairs.
 */
async function getMatchCountsByUser(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: userStickers }, idToCode] = await Promise.all([
    supabase.from("profiles").select("id, status"),
    supabase.from("user_stickers").select("user_id, sticker_id, status"),
    getStickerIdToCodeMap(),
  ]);

  const activeUserIds = ((profiles as Pick<Profile, "id" | "status">[]) ?? [])
    .filter((p) => p.status === "active")
    .map((p) => p.id);

  const duplicatesByUser = new Map<string, Set<string>>();
  const missingByUser = new Map<string, Set<string>>();
  for (const row of (userStickers as Pick<UserSticker, "user_id" | "sticker_id" | "status">[]) ?? []) {
    const code = idToCode.get(row.sticker_id);
    if (!code) continue;
    const target = row.status === "duplicate" ? duplicatesByUser : row.status === "missing" ? missingByUser : null;
    if (!target) continue;
    if (!target.has(row.user_id)) target.set(row.user_id, new Set());
    target.get(row.user_id)!.add(code);
  }

  const counts = new Map<string, number>();
  for (let i = 0; i < activeUserIds.length; i++) {
    for (let j = i + 1; j < activeUserIds.length; j++) {
      const a = activeUserIds[i];
      const b = activeUserIds[j];
      if (usersHaveMutualMatch(a, b, duplicatesByUser, missingByUser)) {
        counts.set(a, (counts.get(a) ?? 0) + 1);
        counts.set(b, (counts.get(b) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function usersHaveMutualMatch(
  a: string,
  b: string,
  duplicatesByUser: Map<string, Set<string>>,
  missingByUser: Map<string, Set<string>>
): boolean {
  const aDup = duplicatesByUser.get(a);
  const aMissing = missingByUser.get(a);
  const bDup = duplicatesByUser.get(b);
  const bMissing = missingByUser.get(b);

  if (aDup && bMissing) {
    for (const code of aDup) if (bMissing.has(code)) return true;
  }
  if (bDup && aMissing) {
    for (const code of bDup) if (aMissing.has(code)) return true;
  }
  return false;
}

// ============================================================================
// Trades management
// ============================================================================

export interface AdminTradeRow extends TradeRequest {
  fromUser: Profile | null;
  toUser: Profile | null;
  itemsGivenByFromUser: string[];
  itemsReceivedByFromUser: string[];
}

export async function getAdminTrades(): Promise<AdminTradeRow[]> {
  const supabase = await createClient();

  const [{ data: trades }, idToCode] = await Promise.all([
    supabase.from("trade_requests").select("*").order("created_at", { ascending: false }),
    getStickerIdToCodeMap(),
  ]);

  const tradeRows = (trades as TradeRequest[]) ?? [];
  if (tradeRows.length === 0) return [];

  const tradeIds = tradeRows.map((t) => t.id);
  const userIds = Array.from(new Set(tradeRows.flatMap((t) => [t.from_user_id, t.to_user_id])));

  const [{ data: items }, { data: profiles }] = await Promise.all([
    supabase.from("trade_request_items").select("*").in("trade_request_id", tradeIds),
    supabase.from("profiles").select("*").in("id", userIds),
  ]);

  const profileMap = new Map(((profiles as Profile[]) ?? []).map((p) => [p.id, p]));
  const itemsByTrade = new Map<string, TradeRequestItem[]>();
  for (const item of (items as TradeRequestItem[]) ?? []) {
    if (!itemsByTrade.has(item.trade_request_id)) itemsByTrade.set(item.trade_request_id, []);
    itemsByTrade.get(item.trade_request_id)!.push(item);
  }

  return tradeRows.map((trade) => {
    const tradeItems = itemsByTrade.get(trade.id) ?? [];
    return {
      ...trade,
      fromUser: profileMap.get(trade.from_user_id) ?? null,
      toUser: profileMap.get(trade.to_user_id) ?? null,
      itemsGivenByFromUser: tradeItems
        .filter((i) => i.direction === "give")
        .map((i) => idToCode.get(i.sticker_id) ?? "")
        .filter(Boolean),
      itemsReceivedByFromUser: tradeItems
        .filter((i) => i.direction === "receive")
        .map((i) => idToCode.get(i.sticker_id) ?? "")
        .filter(Boolean),
    };
  });
}

// ============================================================================
// Statistics
// ============================================================================

export interface StickerStat {
  code: string;
  count: number;
}

export interface TraderStat {
  userId: string;
  fullName: string;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface AdminStatistics {
  mostWantedStickers: StickerStat[];
  mostCommonStickers: StickerStat[];
  mostActiveTraders: TraderStat[];
  tradesPerDay: DailyCount[];
  userGrowth: DailyCount[];
}

const STATS_TOP_N = 10;
const DAILY_WINDOW_DAYS = 14;

function bucketByDay(dates: string[], windowDays: number): DailyCount[] {
  const counts = new Map<string, number>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const days: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
    counts.set(key, 0);
  }

  for (const dateStr of dates) {
    const key = dateStr.slice(0, 10);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }

  return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export async function getAdminStatistics(): Promise<AdminStatistics> {
  const supabase = await createClient();

  const [{ data: userStickers }, { data: trades }, { data: profiles }, idToCode] = await Promise.all([
    supabase.from("user_stickers").select("sticker_id, status"),
    supabase.from("trade_requests").select("from_user_id, to_user_id, created_at"),
    supabase.from("profiles").select("id, full_name, created_at"),
    getStickerIdToCodeMap(),
  ]);

  const stickerRows = (userStickers as Pick<UserSticker, "sticker_id" | "status">[]) ?? [];
  const tradeRows = (trades as Pick<TradeRequest, "from_user_id" | "to_user_id" | "created_at">[]) ?? [];
  const profileRows = (profiles as Pick<Profile, "id" | "full_name" | "created_at">[]) ?? [];

  const countByCode = (status: "missing" | "duplicate" | "have") => {
    const counts = new Map<string, number>();
    for (const row of stickerRows) {
      if (row.status !== status) continue;
      const code = idToCode.get(row.sticker_id);
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, STATS_TOP_N);
  };

  const mostWantedStickers = countByCode("missing");
  // "Most common" = most widely owned (have + duplicate combined), i.e. the
  // stickers that are easiest to find - not just spares available to trade.
  const ownedCounts = new Map<string, number>();
  for (const row of stickerRows) {
    if (row.status !== "have" && row.status !== "duplicate") continue;
    const code = idToCode.get(row.sticker_id);
    if (!code) continue;
    ownedCounts.set(code, (ownedCounts.get(code) ?? 0) + 1);
  }
  const mostCommonStickers = Array.from(ownedCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, STATS_TOP_N);

  const traderCounts = new Map<string, number>();
  for (const t of tradeRows) {
    traderCounts.set(t.from_user_id, (traderCounts.get(t.from_user_id) ?? 0) + 1);
    traderCounts.set(t.to_user_id, (traderCounts.get(t.to_user_id) ?? 0) + 1);
  }
  const nameById = new Map(profileRows.map((p) => [p.id, p.full_name || "אספן"]));
  const mostActiveTraders = Array.from(traderCounts.entries())
    .map(([userId, count]) => ({ userId, fullName: nameById.get(userId) ?? "אספן", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, STATS_TOP_N);

  const tradesPerDay = bucketByDay(tradeRows.map((t) => t.created_at), DAILY_WINDOW_DAYS);
  const userGrowth = bucketByDay(profileRows.map((p) => p.created_at), DAILY_WINDOW_DAYS);

  return { mostWantedStickers, mostCommonStickers, mostActiveTraders, tradesPerDay, userGrowth };
}
