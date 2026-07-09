import { createClient } from "@/lib/supabase/server";
import { getStickerIdToCodeMap } from "@/lib/data/stickers";
import { getCityCoordinates } from "@/lib/cities";
import { deterministicJitter } from "@/lib/distance";
import { computeMatches, type MatchCandidateInput, type MatchLocationSource, type MatchResult } from "@/lib/matching";
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

  const [profileRes, myProfileRes, userStickersRes, idToCode, locationsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("status", "active"),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_stickers").select("*").in("status", ["duplicate", "missing"]),
    getStickerIdToCodeMap(),
    supabase.rpc("nearby_locations", { max_km: 300 }),
  ]);

  const myProfile = myProfileRes.data as Profile | null;
  if (!myProfile) return { matches: [], myCity: "", locationEnabled: false };

  const profiles = ((profileRes.data as Profile[]) ?? []).filter((p) => p.id !== user.id);
  const allUserStickers = (userStickersRes.data as UserSticker[]) ?? [];
  const locationByUserId = new Map<
    string,
    { distanceKm: number; approxLat: number; approxLng: number }
  >(
    (
      (locationsRes.data as
        | { user_id: string; distance_km: number; approx_lat: number; approx_lng: number }[]
        | null) ?? []
    ).map((d) => [d.user_id, { distanceKm: d.distance_km, approxLat: d.approx_lat, approxLng: d.approx_lng }])
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

  /**
   * Resolves the best available approximate map location for a candidate:
   * 1. GPS (nearby_locations(), already server-side jittered) if they
   *    opted into precise location - the accurate distance too.
   * 2. Otherwise, their profile's city center (public data already -
   *    city/neighborhood are visible to everyone, so this isn't a new
   *    privacy boundary), with a small deterministic per-user jitter so
   *    several collectors in the same city don't stack on one point.
   * 3. Otherwise, no location at all - kept in the list, never plotted.
   */
  function resolveApproxLocation(profile: Profile): {
    approxLat: number | null;
    approxLng: number | null;
    locationSource: MatchLocationSource;
  } {
    const gps = locationByUserId.get(profile.id);
    if (gps) {
      return { approxLat: gps.approxLat, approxLng: gps.approxLng, locationSource: "gps" };
    }

    const cityCoords = getCityCoordinates(profile.city);
    if (cityCoords) {
      const jitter = deterministicJitter(profile.id);
      return {
        approxLat: cityCoords.lat + jitter.dLat,
        approxLng: cityCoords.lng + jitter.dLng,
        locationSource: "city",
      };
    }

    return { approxLat: null, approxLng: null, locationSource: null };
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
      distanceKm: locationByUserId.get(p.id)?.distanceKm ?? null,
      ...resolveApproxLocation(p),
    };
  });

  const matches = computeMatches(myDuplicateCodes, myMissingCodes, myProfile.city, candidates);

  return { matches, myCity: myProfile.city, locationEnabled: myProfile.location_enabled };
}
