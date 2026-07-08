import { getLocationRank } from "@/lib/cities";

export interface MatchCandidateInput {
  userId: string;
  fullName: string;
  city: string;
  neighborhood: string | null;
  /** sticker numbers this candidate has spare and is willing to trade/sell */
  duplicateNumbers: number[];
  /** sticker numbers this candidate marked as for-sale (listing_type sale|both) */
  forSaleNumbers: number[];
  /** price (if any) per sticker number this candidate is selling */
  priceByNumber: Record<number, number | null>;
  /** sticker numbers this candidate is missing */
  missingNumbers: number[];
  /** precomputed distance in km from the current user, if both share location, else null */
  distanceKm: number | null;
}

export interface MatchResult {
  userId: string;
  fullName: string;
  city: string;
  neighborhood: string | null;
  /** stickers the current user could RECEIVE from this candidate */
  theyHaveThatINeed: number[];
  /** stickers the current user could GIVE to this candidate */
  theyNeedThatIHave: number[];
  /** stickers this candidate is offering for sale that the current user needs, with price */
  forSaleThatINeed: { number: number; price: number | null }[];
  score: number;
  locationRank: 0 | 1 | 2;
  distanceKm: number | null;
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
  myDuplicateNumbers: number[],
  myMissingNumbers: number[],
  myCity: string,
  candidates: MatchCandidateInput[]
): MatchResult[] {
  const myDuplicateSet = new Set(myDuplicateNumbers);
  const myMissingSet = new Set(myMissingNumbers);

  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const theyHaveThatINeed = candidate.duplicateNumbers.filter((n) => myMissingSet.has(n));
    const theyNeedThatIHave = candidate.missingNumbers.filter((n) => myDuplicateSet.has(n));
    const forSaleThatINeed = candidate.forSaleNumbers
      .filter((n) => myMissingSet.has(n))
      .map((n) => ({ number: n, price: candidate.priceByNumber[n] ?? null }));

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
