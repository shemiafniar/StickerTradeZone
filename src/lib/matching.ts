import { getLocationRank } from "@/lib/cities";

/**
 * Where a match's approximate map coordinates came from, if at all:
 * - "gps": the candidate opted into precise location (jittered server-side
 *   by nearby_locations() - see MatchesMap.tsx's popup text for this case).
 * - "city": the candidate has no GPS location, but their profile's city/
 *   neighborhood resolved to an approximate city-center coordinate.
 * - null: no usable location info at all - kept in the list, never plotted.
 */
export type MatchLocationSource = "gps" | "city" | null;

export interface MatchCandidateInput {
  userId: string;
  fullName: string;
  city: string;
  neighborhood: string | null;
  /** sticker codes this candidate has spare and is willing to trade/sell */
  duplicateCodes: string[];
  /** sticker codes this candidate marked as for-sale (listing_type sale|both) */
  forSaleCodes: string[];
  /** price (if any) per sticker code this candidate is selling */
  priceByCode: Record<string, number | null>;
  /** sticker codes this candidate is missing */
  missingCodes: string[];
  /** precomputed distance in km from the current user, if both share location, else null */
  distanceKm: number | null;
  /** privacy-preserving jittered coordinates for the map view, if the candidate shares a location, else null */
  approxLat: number | null;
  approxLng: number | null;
  locationSource: MatchLocationSource;
}

export interface MatchResult {
  userId: string;
  fullName: string;
  city: string;
  neighborhood: string | null;
  /** stickers the current user could RECEIVE from this candidate */
  theyHaveThatINeed: string[];
  /** stickers the current user could GIVE to this candidate */
  theyNeedThatIHave: string[];
  /** stickers this candidate is offering for sale that the current user needs, with price */
  forSaleThatINeed: { code: string; price: number | null }[];
  score: number;
  locationRank: 0 | 1 | 2;
  distanceKm: number | null;
  /** privacy-preserving jittered coordinates for the map view, if this candidate shares a location, else null */
  approxLat: number | null;
  approxLng: number | null;
  locationSource: MatchLocationSource;
}

/**
 * Pure, side-effect free matching function. Ranks other collectors by:
 * 1) real distance in km when both users share their location (nearest first)
 * 2) number of stickers I could receive from them
 * 3) number of stickers I could give them
 *
 * City/region proximity (`getLocationRank`) is used only as a fallback for
 * collectors without a shared distance, keeping city-based matching alive
 * even before/without opting into location sharing.
 */
export function computeMatches(
  myDuplicateCodes: string[],
  myMissingCodes: string[],
  myCity: string,
  candidates: MatchCandidateInput[]
): MatchResult[] {
  const myDuplicateSet = new Set(myDuplicateCodes);
  const myMissingSet = new Set(myMissingCodes);

  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const theyHaveThatINeed = candidate.duplicateCodes.filter((c) => myMissingSet.has(c));
    const theyNeedThatIHave = candidate.missingCodes.filter((c) => myDuplicateSet.has(c));
    const forSaleThatINeed = candidate.forSaleCodes
      .filter((c) => myMissingSet.has(c))
      .map((c) => ({ code: c, price: candidate.priceByCode[c] ?? null }));

    const score = theyHaveThatINeed.length + theyNeedThatIHave.length;
    if (score === 0) continue;

    results.push({
      userId: candidate.userId,
      fullName: candidate.fullName,
      city: candidate.city,
      neighborhood: candidate.neighborhood,
      theyHaveThatINeed,
      theyNeedThatIHave,
      forSaleThatINeed,
      score,
      locationRank: getLocationRank(myCity, candidate.city),
      distanceKm: candidate.distanceKm,
      approxLat: candidate.approxLat,
      approxLng: candidate.approxLng,
      locationSource: candidate.locationSource,
    });
  }

  const byNeededThenGiven = (a: MatchResult, b: MatchResult) => {
    if (a.theyHaveThatINeed.length !== b.theyHaveThatINeed.length) {
      return b.theyHaveThatINeed.length - a.theyHaveThatINeed.length;
    }
    return b.theyNeedThatIHave.length - a.theyNeedThatIHave.length;
  };

  const withDistance = results
    .filter((r) => r.distanceKm !== null)
    .sort((a, b) => (a.distanceKm! !== b.distanceKm! ? a.distanceKm! - b.distanceKm! : byNeededThenGiven(a, b)));

  const withoutDistance = results
    .filter((r) => r.distanceKm === null)
    .sort((a, b) => (a.locationRank !== b.locationRank ? a.locationRank - b.locationRank : byNeededThenGiven(a, b)));

  return [...withDistance, ...withoutDistance];
}
