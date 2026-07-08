/**
 * Sticker identifiers are `TEAMCODE-number`, e.g. "GER-2", "FRA-17" (a
 * 3-letter FIFA-style team code, a hyphen, and a 1-20 in-team number).
 */
const CODE_PATTERN = /^([A-Za-z]{3})-(\d{1,2})$/;

export function isValidStickerCode(value: string): boolean {
  const match = value.trim().match(CODE_PATTERN);
  if (!match) return false;
  const number = Number(match[2]);
  return number >= 1 && number <= 20;
}

export function normalizeStickerCode(value: string): string | null {
  const match = value.trim().match(CODE_PATTERN);
  if (!match) return null;
  const number = Number(match[2]);
  if (number < 1 || number > 20) return null;
  return `${match[1].toUpperCase()}-${number}`;
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
