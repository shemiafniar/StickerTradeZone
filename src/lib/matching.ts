import { getLocationRank } from "@/lib/cities";

export interface MatchCandidateInput {
  userId: string;
  fullName: string;
  city: string;
  neighborhood: string | null;
  /** sticker numbers this candidate has spare and is willing to trade/sell */
  duplicateNumbers: number[];
  /** sticker numbers this candidate marked as for-sale (subset of duplicateNumbers) */
  forSaleNumbers: number[];
  /** sticker numbers this candidate is missing */
  missingNumbers: number[];
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
  /** stickers this candidate is offering for sale that the current user needs */
  forSaleThatINeed: number[];
  score: number;
  locationRank: 0 | 1 | 2;
}

/**
 * Pure, side-effect free matching function. Ranks other collectors by:
 * 1) location proximity (same city, then same region, then everyone else)
 * 2) match score (how many stickers could move in either direction)
 *
 * `getLocationRank` is the single seam for swapping city-based matching for
 * real GPS distance later - this function does not need to change.
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
    const forSaleThatINeed = candidate.forSaleNumbers.filter((n) => myMissingSet.has(n));

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
    });
  }

  results.sort((a, b) => {
    if (a.locationRank !== b.locationRank) return a.locationRank - b.locationRank;
    return b.score - a.score;
  });

  return results;
}
