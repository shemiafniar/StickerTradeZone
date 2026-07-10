import { createClient } from "@/lib/supabase/server";
import { getStickerIdToCodeMap } from "@/lib/data/stickers";
import { getCityCoordinates } from "@/lib/cities";
import { deterministicJitter } from "@/lib/distance";
import { hasDuplicateAvailable, isMissing } from "@/lib/collectionStatus";
import { computeMatches, type MatchCandidateInput, type MatchLocationSource, type MatchResult } from "@/lib/matching";
import type { Profile, UserSticker } from "@/types/database";

export interface MatchesForUser {
  matches: MatchResult[];
  myCity: string;
  locationEnabled: boolean;
  /** True once the collector has at least one available duplicate or missing mark - false means matching can't produce anything yet, regardless of other collectors. */
  hasCollectionData: boolean;
}

export async function getMatchesForCurrentUser(): Promise<MatchesForUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { matches: [], myCity: "", locationEnabled: false, hasCollectionData: false };

  const [profileRes, myProfileRes, userStickersRes, idToCode, locationsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("status", "active"),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    // Only rows that matter for matching: an available duplicate (quantity
    // >= 2) or an explicit missing mark (quantity = 0) - see
    // src/lib/collectionStatus.ts for the canonical rule. A plain "owned,
    // no duplicate" row (quantity = 1) is irrelevant to matching either way.
    supabase.from("user_stickers").select("*"),
    getStickerIdToCodeMap(),
    supabase.rpc("nearby_locations", { max_km: 300 }),
  ]);

  const myProfile = myProfileRes.data as Profile | null;
  if (!myProfile) return { matches: [], myCity: "", locationEnabled: false, hasCollectionData: false };

  // Best-effort onboarding-journey signal (backs the dashboard checklist -
  // see OnboardingChecklist.tsx): set once, the first time this user's
  // matches actually load. Never blocks or fails the page for this.
  if (!myProfile.matches_first_viewed_at) {
    void supabase
      .from("profiles")
      .update({ matches_first_viewed_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) console.error("[matches] Failed to record matches_first_viewed_at:", error.message);
      });
  }

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
    .filter((d) => d.user_id === user.id && hasDuplicateAvailable(d.quantity))
    .map((d) => idToCode.get(d.sticker_id) ?? "")
    .filter(Boolean);

  const myMissingCodes = allUserStickers
    .filter((m) => m.user_id === user.id && isMissing(m.quantity))
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
    const theirDups = theirs.filter((d) => hasDuplicateAvailable(d.quantity));
    const theirMissing = theirs.filter((m) => isMissing(m.quantity));
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
  const hasCollectionData = myDuplicateCodes.length > 0 || myMissingCodes.length > 0;

  return { matches, myCity: myProfile.city, locationEnabled: myProfile.location_enabled, hasCollectionData };
}
