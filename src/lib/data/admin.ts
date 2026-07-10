import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { getStickerIdToCodeMap } from "@/lib/data/stickers";
import {
  availableDuplicates,
  getStickerCellState,
  hasDuplicateAvailable,
  isMissing,
  isOwned,
  summarizeQuantities,
  type StickerCellState,
} from "@/lib/collectionStatus";
import { requireAdmin } from "@/lib/adminAuth";
import type { Profile, TradeRequest, TradeRequestItem, UserSticker } from "@/types/database";

// ============================================================================
// Users management
// ============================================================================

export interface AdminUserRow extends Profile {
  email: string | null;
  /** Unique stickers with at least one available duplicate (quantity >= 2) - same rule as the user-facing collection/matching. */
  duplicatesCount: number;
  /** Unique stickers with an explicit quantity = 0 row. */
  missingCount: number;
  /** Unique stickers owned (quantity >= 1) - "collection size". */
  collectionSize: number;
  /** Total available duplicate copies (sum of quantity - 1 across duplicate stickers). */
  duplicateCopies: number;
  tradeRequestsCount: number;
  /** How many other collectors this user has an active (mutual, non-zero) match with. */
  matchesCount: number;
}

/**
 * Case-insensitive search across name, email, and city - beta-scale, so
 * filtering client-side after one fetch is fine.
 *
 * IMPORTANT: `profiles`/`user_stickers`/`trade_requests` are fetched with
 * fetchAllRows() (paginated via .range()), not a single .select() - a bare
 * .select() silently truncates to Supabase's default 1000-row cap with no
 * error, so once the platform has enough collectors/stickers/trades to
 * cross that line, a plain .select() would start dropping rows for
 * whichever users happen to land past the cutoff - showing them (and only
 * them) as having an empty/stale collection here, no matter how correct
 * the aggregation logic below is. This was the actual root cause of
 * "the admin panel still shows a collector's old totals after they update
 * their collection" - see fetchAllRows.ts's doc comment.
 */
export async function getAdminUsers(searchTerm?: string): Promise<AdminUserRow[]> {
  const supabase = await createClient();

  const [profiles, userStickers, trades, { data: emailRows }] = await Promise.all([
    fetchAllRows<Profile>((from, to) =>
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).range(from, to)
    ),
    fetchAllRows<Pick<UserSticker, "user_id" | "quantity">>((from, to) =>
      supabase.from("user_stickers").select("user_id, quantity").range(from, to)
    ),
    fetchAllRows<Pick<TradeRequest, "from_user_id" | "to_user_id">>((from, to) =>
      supabase.from("trade_requests").select("from_user_id, to_user_id").range(from, to)
    ),
    supabase.rpc("admin_get_user_emails"),
  ]);

  const emailByUserId = new Map(((emailRows as { id: string; email: string | null }[]) ?? []).map((r) => [r.id, r.email]));

  // Same canonical rules as the user-facing collection page and matching -
  // see src/lib/collectionStatus.ts's doc comment for why this must never
  // be reimplemented ad hoc (that drift is exactly what caused admin
  // statistics to disagree with what collectors actually see).
  const quantitiesByUser = new Map<string, number[]>();
  for (const row of userStickers) {
    if (!quantitiesByUser.has(row.user_id)) quantitiesByUser.set(row.user_id, []);
    quantitiesByUser.get(row.user_id)!.push(row.quantity);
  }

  const tradeCounts = new Map<string, number>();
  for (const t of trades) {
    tradeCounts.set(t.from_user_id, (tradeCounts.get(t.from_user_id) ?? 0) + 1);
    tradeCounts.set(t.to_user_id, (tradeCounts.get(t.to_user_id) ?? 0) + 1);
  }

  const matchCountByUser = await getMatchCountsByUser();

  let rows = profiles.map((p) => {
    const counts = summarizeQuantities(quantitiesByUser.get(p.id) ?? []);
    return {
      ...p,
      email: emailByUserId.get(p.id) ?? null,
      duplicatesCount: counts.duplicateUnique,
      missingCount: counts.missingUnique,
      collectionSize: counts.ownedUnique,
      duplicateCopies: counts.totalDuplicateCopies,
      tradeRequestsCount: tradeCounts.get(p.id) ?? 0,
      matchesCount: matchCountByUser.get(p.id) ?? 0,
    };
  });

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
  /** Unique (user, sticker) pairs with an available duplicate, platform-wide. */
  totalDuplicates: number;
  /** Unique (user, sticker) pairs explicitly marked missing, platform-wide. */
  totalMissing: number;
  /** Sum of available duplicate copies across every collector - see collectionStatus.ts. */
  totalDuplicateCopies: number;
  totalTradeRequests: number;
  pendingTradeRequests: number;
  completedTradeRequests: number;
  totalMatches: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();

  // Paginated - see the doc comment on getAdminUsers() for why a bare
  // .select() here would silently under-count once the platform grows
  // past 1000 rows in any of these tables.
  const [profileRows, stickerRows, tradeRows, matchCounts] = await Promise.all([
    fetchAllRows<{ status: string; location_enabled: boolean }>((from, to) =>
      supabase.from("profiles").select("status, location_enabled").range(from, to)
    ),
    fetchAllRows<Pick<UserSticker, "quantity">>((from, to) =>
      supabase.from("user_stickers").select("quantity").range(from, to)
    ),
    fetchAllRows<{ status: string }>((from, to) => supabase.from("trade_requests").select("status").range(from, to)),
    getMatchCountsByUser(),
  ]);

  // Every mutual match is counted once per participant by getMatchCountsByUser(),
  // so summing and halving gives the number of distinct matching pairs.
  const totalMatches = Array.from(matchCounts.values()).reduce((sum, n) => sum + n, 0) / 2;
  const collectionCounts = summarizeQuantities(stickerRows.map((s) => s.quantity));

  return {
    totalUsers: profileRows.length,
    activeUsers: profileRows.filter((p) => p.status === "active").length,
    suspendedUsers: profileRows.filter((p) => p.status === "suspended").length,
    usersWithLocation: profileRows.filter((p) => p.location_enabled).length,
    totalDuplicates: collectionCounts.duplicateUnique,
    totalMissing: collectionCounts.missingUnique,
    totalDuplicateCopies: collectionCounts.totalDuplicateCopies,
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
  const [profiles, userStickers, idToCode] = await Promise.all([
    fetchAllRows<Pick<Profile, "id" | "status">>((from, to) =>
      supabase.from("profiles").select("id, status").range(from, to)
    ),
    fetchAllRows<Pick<UserSticker, "user_id" | "sticker_id" | "quantity">>((from, to) =>
      supabase.from("user_stickers").select("user_id, sticker_id, quantity").range(from, to)
    ),
    getStickerIdToCodeMap(),
  ]);

  const activeUserIds = profiles.filter((p) => p.status === "active").map((p) => p.id);

  const duplicatesByUser = new Map<string, Set<string>>();
  const missingByUser = new Map<string, Set<string>>();
  for (const row of userStickers) {
    const code = idToCode.get(row.sticker_id);
    if (!code) continue;
    const target = hasDuplicateAvailable(row.quantity) ? duplicatesByUser : isMissing(row.quantity) ? missingByUser : null;
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

  const [tradeRows, idToCode] = await Promise.all([
    fetchAllRows<TradeRequest>((from, to) =>
      supabase.from("trade_requests").select("*").order("created_at", { ascending: false }).range(from, to)
    ),
    getStickerIdToCodeMap(),
  ]);

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

  const [stickerRows, tradeRows, profileRows, idToCode] = await Promise.all([
    fetchAllRows<Pick<UserSticker, "sticker_id" | "quantity">>((from, to) =>
      supabase.from("user_stickers").select("sticker_id, quantity").range(from, to)
    ),
    fetchAllRows<Pick<TradeRequest, "from_user_id" | "to_user_id" | "created_at">>((from, to) =>
      supabase.from("trade_requests").select("from_user_id, to_user_id, created_at").range(from, to)
    ),
    fetchAllRows<Pick<Profile, "id" | "full_name" | "created_at">>((from, to) =>
      supabase.from("profiles").select("id, full_name, created_at").range(from, to)
    ),
    getStickerIdToCodeMap(),
  ]);

  function topByCode(predicate: (quantity: number) => boolean) {
    const counts = new Map<string, number>();
    for (const row of stickerRows) {
      if (!predicate(row.quantity)) continue;
      const code = idToCode.get(row.sticker_id);
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, STATS_TOP_N);
  }

  // "Most wanted" = most explicit missing marks (quantity = 0).
  const mostWantedStickers = topByCode(isMissing);
  // "Most common" = most widely owned (quantity >= 1), i.e. the stickers
  // that are easiest to find - not just spares available to trade.
  const mostCommonStickers = topByCode(isOwned);

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

// ============================================================================
// Per-user collection detail (admin-only, read-only) - requirement #5:
// a full breakdown of a single collector's collection, reusing the exact
// same canonical rules as everywhere else (collectionStatus.ts). This is
// intentionally NOT exposed via any user-facing route or public API - the
// only caller is /admin/users/[id]/page.tsx, itself gated by the existing
// admin/layout.tsx server-side redirect.
// ============================================================================

/** Re-exported so existing importers (e.g. AdminUserCollectionPanel.tsx) don't need to know this now comes from collectionStatus.ts. */
export type StickerRowState = StickerCellState;

export interface AdminStickerRow {
  code: string;
  teamCode: string;
  teamNameHe: string;
  number: number;
  /** null = unmarked (no user_stickers row at all) - see collectionStatus.ts. Never counted as "missing". */
  quantity: number | null;
  availableDuplicates: number;
  state: StickerRowState;
  listingType: string | null;
  price: number | null;
}

export interface AdminTeamBreakdown {
  code: string;
  nameHe: string;
  owned: number;
  missing: number;
  duplicates: number;
  duplicateCopies: number;
  total: number;
  completionPct: number;
}

export interface AdminUserCollectionDetail {
  ownedUnique: number;
  missingUnique: number;
  duplicateUnique: number;
  totalDuplicateCopies: number;
  totalStickers: number;
  completionPct: number;
  teams: AdminTeamBreakdown[];
  stickers: AdminStickerRow[];
}

/**
 * Defense in depth: re-verifies the caller is an admin even though every
 * caller of this function is already nested under app/admin/layout.tsx's
 * own server-side redirect - this per-user collection breakdown is
 * sensitive enough (full sticker-by-sticker detail) that it must never be
 * reachable if a future route ever forgets that layout guard.
 */
export async function getAdminUserCollectionDetail(userId: string): Promise<AdminUserCollectionDetail> {
  const { supabase } = await requireAdmin();

  // The sticker catalog is currently 960 rows (48 teams x 20) - already
  // close enough to Supabase's default 1000-row cap that adding a handful
  // more teams would silently start dropping stickers from a bare
  // .select(); paginated defensively here for the same reason as every
  // other platform-wide query in this file (see fetchAllRows.ts).
  const [teamRows, stickerRows, { data: userStickers }] = await Promise.all([
    fetchAllRows<{ code: string; name_he: string }>((from, to) =>
      supabase
        .from("teams")
        .select("code, name_he")
        .order("group_order", { ascending: true })
        .order("team_order", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<{ id: string; team_code: string; number: number; code: string }>((from, to) =>
      supabase.from("stickers").select("id, team_code, number, code").range(from, to)
    ),
    supabase.from("user_stickers").select("sticker_id, quantity, listing_type, price").eq("user_id", userId),
  ]);
  const ownedByStickerId = new Map(
    ((userStickers as Pick<UserSticker, "sticker_id" | "quantity" | "listing_type" | "price">[]) ?? []).map((u) => [
      u.sticker_id,
      u,
    ])
  );
  const teamNameByCode = new Map(teamRows.map((t) => [t.code, t.name_he]));

  // IMPORTANT: `quantity` stays `null` for a sticker with no user_stickers
  // row at all ("unmarked" - not yet looked at), distinct from an explicit
  // quantity = 0 row ("missing" - the collector actively marked it as
  // needed). Folding "unmarked" into "missing" here would inflate this
  // page's missing count to include the collector's entire *unmarked*
  // catalog, which is exactly the sync bug this fixes: getCollectionCounts()/
  // getAdminUsers() only ever look at rows that actually exist, so this
  // detail page must do the same for its headline numbers to agree with
  // them. getStickerCellState()/availableDuplicates() are the same
  // collectionStatus.ts helpers used everywhere else - no separate logic.
  const allStickerRows: AdminStickerRow[] = stickerRows
    .map((s) => {
      const owned = ownedByStickerId.get(s.id);
      const quantity = owned?.quantity ?? null;
      return {
        code: s.code,
        teamCode: s.team_code,
        teamNameHe: teamNameByCode.get(s.team_code) ?? s.team_code,
        number: s.number,
        quantity,
        availableDuplicates: quantity === null ? 0 : availableDuplicates(quantity),
        state: getStickerCellState(quantity),
        listingType: owned?.listing_type ?? null,
        price: owned?.price ?? null,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  // Only rows that actually exist (quantity !== null) feed the aggregate
  // counts - identical in spirit to getCollectionCounts()'s
  // `.from("user_stickers")...` query, which by construction never sees an
  // unmarked sticker either (there's no row for it to return).
  const existingQuantities = (quantities: (number | null)[]) =>
    quantities.filter((q): q is number => q !== null);

  const overall = summarizeQuantities(existingQuantities(allStickerRows.map((s) => s.quantity)));

  const teamBreakdowns: AdminTeamBreakdown[] = teamRows.map((team) => {
    const teamStickers = allStickerRows.filter((s) => s.teamCode === team.code);
    const counts = summarizeQuantities(existingQuantities(teamStickers.map((s) => s.quantity)));
    const total = teamStickers.length;
    return {
      code: team.code,
      nameHe: team.name_he,
      owned: counts.ownedUnique,
      missing: counts.missingUnique,
      duplicates: counts.duplicateUnique,
      duplicateCopies: counts.totalDuplicateCopies,
      total,
      completionPct: total > 0 ? Math.round((counts.ownedUnique / total) * 100) : 0,
    };
  });

  return {
    ownedUnique: overall.ownedUnique,
    missingUnique: overall.missingUnique,
    duplicateUnique: overall.duplicateUnique,
    totalDuplicateCopies: overall.totalDuplicateCopies,
    totalStickers: allStickerRows.length,
    completionPct: allStickerRows.length > 0 ? Math.round((overall.ownedUnique / allStickerRows.length) * 100) : 0,
    teams: teamBreakdowns,
    stickers: allStickerRows,
  };
}
