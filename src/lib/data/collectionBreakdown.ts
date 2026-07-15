import type { SupabaseClient } from "@supabase/supabase-js";
import { availableDuplicates, getStickerCellState, summarizeQuantities, type StickerCellState } from "@/lib/collectionStatus";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { Database, UserSticker } from "@/types/database";

/**
 * The actual per-sticker/per-team collection-breakdown logic, extracted so
 * it has exactly one implementation shared by both the admin per-user
 * detail page (`getAdminUserCollectionDetail()` in `data/admin.ts`, which
 * still gates access via `requireAdmin()` before calling this) and the
 * user-facing collection export (`getMyCollectionForExport()` in
 * `data/collectionExport.ts`, which always passes the caller's *own*
 * `auth.uid()` and nothing else).
 *
 * This function itself performs NO authorization check - callers are
 * responsible for deciding whose `userId` is safe to pass in. It never
 * uses a service-role client; it always runs with whatever
 * already-authenticated `supabase` client the caller provides, subject to
 * the same RLS as everything else in this app.
 */

export type CollectionStickerState = StickerCellState;

export interface CollectionStickerRow {
  code: string;
  teamCode: string;
  teamNameHe: string;
  number: number;
  /** null = unmarked (no user_stickers row at all) - see collectionStatus.ts. Never counted as "missing". */
  quantity: number | null;
  availableDuplicates: number;
  state: CollectionStickerState;
  listingType: string | null;
  price: number | null;
}

export interface CollectionTeamBreakdown {
  code: string;
  nameHe: string;
  owned: number;
  missing: number;
  duplicates: number;
  duplicateCopies: number;
  total: number;
  completionPct: number;
}

export interface CollectionBreakdown {
  ownedUnique: number;
  missingUnique: number;
  duplicateUnique: number;
  totalDuplicateCopies: number;
  totalStickers: number;
  completionPct: number;
  teams: CollectionTeamBreakdown[];
  stickers: CollectionStickerRow[];
}

export async function buildCollectionBreakdown(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CollectionBreakdown> {
  // The sticker catalog is currently 960 rows (48 teams x 20) - already
  // close enough to Supabase's default 1000-row cap that adding a handful
  // more teams would silently start dropping stickers from a bare
  // .select(); paginated defensively here for the same reason as every
  // other platform-wide query in this codebase (see fetchAllRows.ts).
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
  // needed). Folding "unmarked" into "missing" here would inflate the
  // missing count to include the collector's entire *unmarked* catalog -
  // see collectionStatus.ts's own doc comment for why this exact mistake
  // caused a real production bug once already. getStickerCellState()/
  // availableDuplicates() are the same collectionStatus.ts helpers used
  // everywhere else in the app - never re-derived ad hoc here.
  const allStickerRows: CollectionStickerRow[] = stickerRows
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
    // Sorted by the actual numeric team+number, not the code *string* -
    // "FWC-10" must sort after "FWC-9", not between "FWC-1" and "FWC-2" the
    // way a plain string comparison would place it. This matters for every
    // team once it has any double-digit sticker number, not just FWC.
    .sort((a, b) => a.teamCode.localeCompare(b.teamCode) || a.number - b.number);

  // Only rows that actually exist (quantity !== null) feed the aggregate
  // counts - identical in spirit to getCollectionCounts()'s
  // `.from("user_stickers")...` query, which by construction never sees an
  // unmarked sticker either (there's no row for it to return).
  const existingQuantities = (quantities: (number | null)[]) => quantities.filter((q): q is number => q !== null);

  const overall = summarizeQuantities(existingQuantities(allStickerRows.map((s) => s.quantity)));

  const teamBreakdowns: CollectionTeamBreakdown[] = teamRows.map((team) => {
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
