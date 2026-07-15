import { createClient } from "@/lib/supabase/server";
import { buildCollectionBreakdown, type CollectionStickerRow } from "@/lib/data/collectionBreakdown";

export type CollectionExportFilter =
  | "full"
  | "owned"
  | "missing"
  | "duplicates"
  | "for_sale"
  | "for_trade"
  | "team";

export interface CollectionExportRow {
  code: string;
  team: string;
  number: number;
  quantityOwned: number;
  availableDuplicates: number;
  status: "owned" | "missing" | "unmarked";
  listingType: string | null;
  price: number | null;
}

function matchesFilter(row: CollectionStickerRow, filter: CollectionExportFilter, teamCode?: string): boolean {
  switch (filter) {
    case "full":
      return true;
    case "owned":
      return row.quantity !== null && row.quantity >= 1;
    case "missing":
      // "Missing" for export purposes means every sticker the collector
      // does not currently own - both explicitly-marked-missing (quantity
      // 0) and never-marked-at-all (quantity null) - since from the
      // user's perspective exporting "what I still need" should include
      // both, unlike the admin/matching "missing" definition which only
      // ever counts explicit quantity=0 rows (see collectionStatus.ts).
      return row.quantity === null || row.quantity === 0;
    case "duplicates":
      return row.availableDuplicates >= 1;
    case "for_sale":
      return row.listingType === "sale" || row.listingType === "both";
    case "for_trade":
      return row.listingType === "trade" || row.listingType === "both";
    case "team":
      return teamCode ? row.teamCode === teamCode : true;
  }
}

function toExportRow(row: CollectionStickerRow): CollectionExportRow {
  return {
    code: row.code,
    team: row.teamNameHe,
    number: row.number,
    quantityOwned: row.quantity ?? 0,
    availableDuplicates: row.availableDuplicates,
    status: row.quantity === null ? "unmarked" : row.quantity >= 1 ? "owned" : "missing",
    listingType: row.listingType,
    price: row.price,
  };
}

/**
 * User-scoped collection export data - always for the *caller's own*
 * session, never accepting a userId parameter from outside, unlike
 * getAdminUserCollectionDetail() in data/admin.ts (which is admin-only and
 * takes an explicit target userId gated by requireAdmin()). This is the
 * intentional boundary that keeps "any logged-in user can export their own
 * collection" from ever becoming "any logged-in user can export anyone's
 * collection" - there is no code path here that could leak another user's
 * rows even if the admin-only function is later changed.
 *
 * Returns null when there is no authenticated session at all - callers
 * (the export route handler) must treat that as a 401, not an empty file.
 */
export async function getMyCollectionForExport(
  filter: CollectionExportFilter,
  teamCode?: string
): Promise<CollectionExportRow[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const breakdown = await buildCollectionBreakdown(supabase, user.id);
  return breakdown.stickers.filter((row) => matchesFilter(row, filter, teamCode)).map(toExportRow);
}
