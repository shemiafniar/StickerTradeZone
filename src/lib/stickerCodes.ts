/**
 * Sticker identifiers are `TEAMCODE-number`, e.g. "GER-2", "FRA-17" (a
 * 3-letter FIFA-style team code, a hyphen, and an in-team number).
 *
 * Every ordinary team numbers its 20 stickers 1-20. FWC (the bonus "FIFA
 * World Cup" set added by the site administrator through the admin
 * catalog, not one of the official 48 national teams) is the one
 * exception, numbering its 20 stickers 0-19 instead - see
 * supabase/migrations/0019_fwc_numbering.sql for the full history/
 * rationale and the one-time renumbering of the FWC rows that already
 * existed with the (incorrect, pre-that-migration) 1-20 range.
 */
const CODE_PATTERN = /^([A-Za-z]{3})-(\d{1,2})$/;

const FWC_TEAM_CODE = "FWC";

/** The valid in-team number range for a given team code - 0-19 for FWC, 1-20 for every ordinary team. */
export function stickerNumberRangeForTeam(teamCode: string): { min: number; max: number } {
  return teamCode.toUpperCase() === FWC_TEAM_CODE ? { min: 0, max: 19 } : { min: 1, max: 20 };
}

/** Whether `number` falls within the valid in-team range for `teamCode` - the single shared rule used by both code parsing below and the Vision provider's own OCR-result validation (src/lib/vision/openaiProvider.ts), so the two can never drift apart. */
export function isValidStickerNumberForTeam(teamCode: string, number: number): boolean {
  const { min, max } = stickerNumberRangeForTeam(teamCode);
  return Number.isInteger(number) && number >= min && number <= max;
}

export function isValidStickerCode(value: string): boolean {
  const match = value.trim().match(CODE_PATTERN);
  if (!match) return false;
  return isValidStickerNumberForTeam(match[1], Number(match[2]));
}

export function normalizeStickerCode(value: string): string | null {
  const match = value.trim().match(CODE_PATTERN);
  if (!match) return null;
  const team = match[1].toUpperCase();
  const number = Number(match[2]);
  if (!isValidStickerNumberForTeam(team, number)) return null;
  return `${team}-${number}`;
}

/**
 * Parses free-text sticker code lists such as "GER-2, FRA-17" or one per
 * line. Invalid tokens are silently skipped. Returns a sorted, de-duplicated
 * list of normalized codes (uppercase team code).
 */
export function parseStickerCodes(input: string): string[] {
  const codes = new Set<string>();

  const parts = input
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalized = normalizeStickerCode(part);
    if (normalized) codes.add(normalized);
  }

  return Array.from(codes).sort();
}

function formatNumberRanges(numbers: number[]): string {
  if (numbers.length === 0) return "";
  const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current !== prev + 1) {
      ranges.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
      rangeStart = current;
    }
    prev = current;
  }

  return ranges.join(", ");
}

/**
 * Pretty, grouped-by-team display of a list of sticker codes, e.g.
 * ["GER-1","GER-2","GER-3","FRA-17"] -> "GER 1-3 · FRA 17".
 */
export function formatStickerCodesByTeam(codes: string[]): string {
  if (codes.length === 0) return "";

  const byTeam = new Map<string, number[]>();
  for (const code of codes) {
    const normalized = normalizeStickerCode(code);
    if (!normalized) continue;
    const [team, numberStr] = normalized.split("-");
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team)!.push(Number(numberStr));
  }

  return Array.from(byTeam.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([team, numbers]) => `${team} ${formatNumberRanges(numbers)}`)
    .join(" · ");
}

/** Simple, parseable serialization for URL params / round-tripping. */
export function serializeStickerCodes(codes: string[]): string {
  return codes.join(",");
}

/**
 * A `.sort()` comparator for sticker code *strings* (e.g. for a list that
 * only carries `code` and not a separate team/number pair) that orders by
 * team code, then by number *numerically* - never by comparing the code
 * strings directly, which would put "FWC-10" between "FWC-1" and "FWC-2"
 * instead of after "FWC-9". Codes that fail to parse sort after every
 * valid one, stably ordered relative to each other by their raw string.
 */
export function compareStickerCodes(a: string, b: string): number {
  const matchA = a.match(CODE_PATTERN);
  const matchB = b.match(CODE_PATTERN);
  if (!matchA || !matchB) return a.localeCompare(b);

  const teamCompare = matchA[1].localeCompare(matchB[1]);
  if (teamCompare !== 0) return teamCompare;
  return Number(matchA[2]) - Number(matchB[2]);
}
