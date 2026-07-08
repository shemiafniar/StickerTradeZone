import { createClient } from "@/lib/supabase/server";
import { getStickerIdToCodeMap } from "@/lib/data/stickers";
import { computeMatches, type MatchCandidateInput, type MatchResult } from "@/lib/matching";
import type { Profile, UserSticker } from "@/types/database";

export async function getMatchesForCurrentUser(): Promise<{
  matches: MatchResult[];
  myCity: string;
  locationEnabled: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { matches: [], myCity: "", locationEnabled: false };

  const [profileRes, myProfileRes, userStickersRes, idToCode, distancesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("status", "active"),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_stickers").select("*").in("status", ["duplicate", "missing"]),
    getStickerIdToCodeMap(),
    supabase.rpc("nearby_distances", { max_km: 300 }),
  ]);

  const myProfile = myProfileRes.data as Profile | null;
  if (!myProfile) return { matches: [], myCity: "", locationEnabled: false };

  const profiles = ((profileRes.data as Profile[]) ?? []).filter((p) => p.id !== user.id);
  const allUserStickers = (userStickersRes.data as UserSticker[]) ?? [];
  const distanceByUserId = new Map<string, number>(
    ((distancesRes.data as { user_id: string; distance_km: number }[] | null) ?? []).map((d) => [
      d.user_id,
      d.distance_km,
    ])
  );

  const myDuplicateCodes = allUserStickers
    .filter((d) => d.user_id === user.id && d.status === "duplicate")
    .map((d) => idToCode.get(d.sticker_id) ?? "")
    .filter(Boolean);

  const myMissingCodes = allUserStickers
    .filter((m) => m.user_id === user.id && m.status === "missing")
    .map((m) => idToCode.get(m.sticker_id) ?? "")
    .filter(Boolean);

  const byUser = new Map<string, UserSticker[]>();
  for (const row of allUserStickers) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id)!.push(row);
  }

  const candidates: MatchCandidateInput[] = profiles.map((p) => {
    const theirs = byUser.get(p.id) ?? [];
    const theirDups = theirs.filter((d) => d.status === "duplicate");
    const theirMissing = theirs.filter((m) => m.status === "missing");
    const priceByCode: Record<string, number | null> = {};
    for (const d of theirDups) {
      if (d.listing_type === "sale" || d.listing_type === "both") {
        const code = idToCode.get(d.sticker_id);
        if (code) priceByCode[code] = d.price;
      }
    }

    return {
      userId: p.id,
      fullName: p.full_name || "אספן",
      city: p.city,
      neighborhood: p.neighborhood,
      duplicateCodes: theirDups.map((d) => idToCode.get(d.sticker_id) ?? "").filter(Boolean),
      forSaleCodes: theirDups
        .filter((d) => d.listing_type === "sale" || d.listing_type === "both")
        .map((d) => idToCode.get(d.sticker_id) ?? "")
        .filter(Boolean),
      priceByCode,
      missingCodes: theirMissing.map((m) => idToCode.get(m.sticker_id) ?? "").filter(Boolean),
      distanceKm: distanceByUserId.get(p.id) ?? null,
    };
  });

  const matches = computeMatches(myDuplicateCodes, myMissingCodes, myProfile.city, candidates);

  return { matches, myCity: myProfile.city, locationEnabled: myProfile.location_enabled };
}
