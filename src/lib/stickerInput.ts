/**
 * Parses fast bulk sticker input such as "1,2,3" or "1-20" or a mix like
 * "1-5, 8, 12-14". Returns a sorted, de-duplicated list of sticker numbers.
 */
export function parseStickerNumbers(input: string, maxNumber = 100000): number[] {
  const numbers = new Set<number>();

  const parts = input
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      let [start, end] = [Number(rangeMatch[1]), Number(rangeMatch[2])];
      if (start > end) [start, end] = [end, start];
      for (let n = start; n <= end && n <= maxNumber; n++) {
        if (n > 0) numbers.add(n);
      }
      continue;
    }

    const singleMatch = part.match(/^(\d+)$/);
    if (singleMatch) {
      const n = Number(singleMatch[1]);
      if (n > 0 && n <= maxNumber) numbers.add(n);
    }
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

export function formatStickerNumbersAsRanges(numbers: number[]): string {
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
