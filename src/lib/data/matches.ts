import { createClient } from "@/lib/supabase/server";
import { getStickerIdToNumberMap } from "@/lib/data/stickers";
import { computeMatches, type MatchCandidateInput, type MatchResult } from "@/lib/matching";
import type { Profile, UserDuplicate, UserMissing } from "@/types/database";

export async function getMatchesForCurrentUser(): Promise<{
  matches: MatchResult[];
  myCity: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { matches: [], myCity: "" };

  const [profileRes, myProfileRes, allDupsRes, allMissingRes, idToNumber] = await Promise.all([
    supabase.from("profiles").select("*").eq("status", "active"),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_duplicates").select("*"),
    supabase.from("user_missing").select("*"),
    getStickerIdToNumberMap(),
  ]);

  const myProfile = myProfileRes.data as Profile | null;
  if (!myProfile) return { matches: [], myCity: "" };

  const profiles = ((profileRes.data as Profile[]) ?? []).filter((p) => p.id !== user.id);
  const allDuplicates = (allDupsRes.data as UserDuplicate[]) ?? [];
  const allMissing = (allMissingRes.data as UserMissing[]) ?? [];

  const myDuplicateNumbers = allDuplicates
    .filter((d) => d.user_id === user.id)
    .map((d) => idToNumber.get(d.sticker_id) ?? 0)
    .filter(Boolean);

  const myMissingNumbers = allMissing
    .filter((m) => m.user_id === user.id)
    .map((m) => idToNumber.get(m.sticker_id) ?? 0)
    .filter(Boolean);

  const dupsByUser = new Map<string, UserDuplicate[]>();
  for (const d of allDuplicates) {
    if (!dupsByUser.has(d.user_id)) dupsByUser.set(d.user_id, []);
    dupsByUser.get(d.user_id)!.push(d);
  }

  const missingByUser = new Map<string, UserMissing[]>();
  for (const m of allMissing) {
    if (!missingByUser.has(m.user_id)) missingByUser.set(m.user_id, []);
    missingByUser.get(m.user_id)!.push(m);
  }

  const candidates: MatchCandidateInput[] = profiles.map((p) => {
    const theirDups = dupsByUser.get(p.id) ?? [];
    const theirMissing = missingByUser.get(p.id) ?? [];
    return {
      userId: p.id,
      fullName: p.full_name || "אספן",
      city: p.city,
      neighborhood: p.neighborhood,
      duplicateNumbers: theirDups.map((d) => idToNumber.get(d.sticker_id) ?? 0).filter(Boolean),
      forSaleNumbers: theirDups
        .filter((d) => d.for_sale)
        .map((d) => idToNumber.get(d.sticker_id) ?? 0)
        .filter(Boolean),
      missingNumbers: theirMissing.map((m) => idToNumber.get(m.sticker_id) ?? 0).filter(Boolean),
    };
  });

  const matches = computeMatches(myDuplicateNumbers, myMissingNumbers, myProfile.city, candidates);

  return { matches, myCity: myProfile.city };
}
