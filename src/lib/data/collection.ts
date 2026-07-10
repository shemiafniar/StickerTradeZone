import { createClient } from "@/lib/supabase/server";
import { getTeams, getTeamByCode, getStickersForTeam } from "@/lib/data/teams";
import { getStickerCatalog, getStickerIdToCodeMap } from "@/lib/data/stickers";
import { availableDuplicates, summarizeQuantities, type CollectionCounts } from "@/lib/collectionStatus";
import type { ListingType, Team, UserSticker } from "@/types/database";

export interface TeamProgress extends Team {
  /** Unique stickers with quantity >= 1. */
  owned: number;
  /** Unique stickers with an explicit quantity = 0 row. */
  missing: number;
  /** Unique stickers with at least one available duplicate (quantity >= 2). */
  duplicates: number;
  /** Total available duplicate copies within this team. */
  duplicateCopies: number;
  total: number;
}

/** Per-team progress counts for the team-cards list ("My Collection" home). */
export async function getTeamsWithProgress(userId: string): Promise<TeamProgress[]> {
  const supabase = await createClient();
  const [teams, stickers, userStickersRes] = await Promise.all([
    getTeams(),
    getStickerCatalog(),
    supabase.from("user_stickers").select("sticker_id, quantity").eq("user_id", userId),
  ]);

  const teamCodeBySticker = new Map(stickers.map((s) => [s.id, s.team_code]));

  const quantitiesByTeam = new Map<string, number[]>();
  for (const row of (userStickersRes.data as Pick<UserSticker, "sticker_id" | "quantity">[]) ?? []) {
    const teamCode = teamCodeBySticker.get(row.sticker_id);
    if (!teamCode) continue;
    if (!quantitiesByTeam.has(teamCode)) quantitiesByTeam.set(teamCode, []);
    quantitiesByTeam.get(teamCode)!.push(row.quantity);
  }

  return teams.map((team) => {
    const counts = summarizeQuantities(quantitiesByTeam.get(team.code) ?? []);
    return {
      ...team,
      owned: counts.ownedUnique,
      missing: counts.missingUnique,
      duplicates: counts.duplicateUnique,
      duplicateCopies: counts.totalDuplicateCopies,
      total: 20,
    };
  });
}

export interface StickerCell {
  id: string;
  code: string;
  number: number;
  /** null = unmarked (no row, gray). 0 = missing (red). 1 = owned (green). 2+ = owned with (quantity-1) duplicates (blue, shows count). */
  quantity: number | null;
  listing_type: ListingType;
  price: number | null;
  note: string | null;
}

/** The 20-sticker grid for a single team, with the current user's quantity per sticker. */
export async function getTeamGrid(
  userId: string,
  teamCode: string
): Promise<{ team: Team; cells: StickerCell[] } | null> {
  const supabase = await createClient();
  const [team, stickers] = await Promise.all([getTeamByCode(teamCode), getStickersForTeam(teamCode)]);
  if (!team || stickers.length === 0) return null;

  const { data: userStickers } = await supabase
    .from("user_stickers")
    .select("*")
    .eq("user_id", userId)
    .in(
      "sticker_id",
      stickers.map((s) => s.id)
    );

  const byStickerId = new Map(((userStickers as UserSticker[]) ?? []).map((u) => [u.sticker_id, u]));

  const cells: StickerCell[] = stickers.map((s) => {
    const owned = byStickerId.get(s.id);
    return {
      id: s.id,
      code: s.code,
      number: s.number,
      quantity: owned?.quantity ?? null,
      listing_type: owned?.listing_type ?? "trade",
      price: owned?.price ?? null,
      note: owned?.note ?? null,
    };
  });

  return { team, cells };
}

/** Canonical whole-collection counts for the current user - the same rules getAdminUsers()/getAdminStats() use for every other collector. */
export async function getCollectionCounts(userId: string): Promise<CollectionCounts> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_stickers").select("quantity").eq("user_id", userId);
  const rows = (data as Pick<UserSticker, "quantity">[]) ?? [];
  return summarizeQuantities(rows.map((r) => r.quantity));
}

export interface DuplicateListing {
  id: string;
  stickerId: string;
  code: string;
  quantity: number;
  /** availableDuplicates(quantity) - how many spare copies can be listed/traded. */
  availableDuplicates: number;
  listing_type: ListingType;
  price: number | null;
  note: string | null;
}

/** All of the current user's stickers with at least one available duplicate, for the marketplace-details editor. */
export async function getUserDuplicateListings(userId: string): Promise<DuplicateListing[]> {
  const supabase = await createClient();
  const [{ data }, idToCode] = await Promise.all([
    supabase.from("user_stickers").select("*").eq("user_id", userId).gte("quantity", 2),
    getStickerIdToCodeMap(),
  ]);

  return ((data as UserSticker[]) ?? [])
    .map((d) => ({
      id: d.id,
      stickerId: d.sticker_id,
      code: idToCode.get(d.sticker_id) ?? "",
      quantity: d.quantity,
      availableDuplicates: availableDuplicates(d.quantity),
      listing_type: d.listing_type,
      price: d.price,
      note: d.note,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
