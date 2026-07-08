import { createClient } from "@/lib/supabase/server";
import { getTeams, getTeamByCode, getStickersForTeam } from "@/lib/data/teams";
import { getStickerCatalog, getStickerIdToCodeMap } from "@/lib/data/stickers";
import type { ListingType, StickerStatus, Team, UserSticker } from "@/types/database";

export interface TeamProgress extends Team {
  have: number;
  duplicate: number;
  missing: number;
  total: number;
}

/** Per-team progress counts for the team-cards list ("My Collection" home). */
export async function getTeamsWithProgress(userId: string): Promise<TeamProgress[]> {
  const supabase = await createClient();
  const [teams, stickers, userStickersRes] = await Promise.all([
    getTeams(),
    getStickerCatalog(),
    supabase.from("user_stickers").select("sticker_id, status").eq("user_id", userId),
  ]);

  const teamCodeBySticker = new Map(stickers.map((s) => [s.id, s.team_code]));

  const countsByTeam = new Map<string, { have: number; duplicate: number; missing: number }>();
  for (const row of (userStickersRes.data as Pick<UserSticker, "sticker_id" | "status">[]) ?? []) {
    const teamCode = teamCodeBySticker.get(row.sticker_id);
    if (!teamCode) continue;
    if (!countsByTeam.has(teamCode)) countsByTeam.set(teamCode, { have: 0, duplicate: 0, missing: 0 });
    countsByTeam.get(teamCode)![row.status] += 1;
  }

  return teams.map((team) => ({
    ...team,
    ...(countsByTeam.get(team.code) ?? { have: 0, duplicate: 0, missing: 0 }),
    total: 20,
  }));
}

export interface StickerCell {
  id: string;
  code: string;
  number: number;
  status: "none" | StickerStatus;
  listing_type: ListingType;
  price: number | null;
  note: string | null;
}

/** The 20-sticker grid for a single team, with the current user's status per sticker. */
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
      status: owned?.status ?? "none",
      listing_type: owned?.listing_type ?? "trade",
      price: owned?.price ?? null,
      note: owned?.note ?? null,
    };
  });

  return { team, cells };
}

export async function getCollectionCounts(
  userId: string
): Promise<{ have: number; duplicates: number; missing: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_stickers").select("status").eq("user_id", userId);
  const rows = (data as Pick<UserSticker, "status">[]) ?? [];

  return {
    have: rows.filter((r) => r.status === "have").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    missing: rows.filter((r) => r.status === "missing").length,
  };
}

export interface DuplicateListing {
  id: string;
  stickerId: string;
  code: string;
  listing_type: ListingType;
  price: number | null;
  note: string | null;
}

/** All of the current user's tradeable duplicates, for the marketplace-details editor. */
export async function getUserDuplicateListings(userId: string): Promise<DuplicateListing[]> {
  const supabase = await createClient();
  const [{ data }, idToCode] = await Promise.all([
    supabase.from("user_stickers").select("*").eq("user_id", userId).eq("status", "duplicate"),
    getStickerIdToCodeMap(),
  ]);

  return ((data as UserSticker[]) ?? [])
    .map((d) => ({
      id: d.id,
      stickerId: d.sticker_id,
      code: idToCode.get(d.sticker_id) ?? "",
      listing_type: d.listing_type,
      price: d.price,
      note: d.note,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
