import type { AlbumScanResult, DuplicateScanResult, VisionProvider } from "@/lib/vision/types";

/**
 * Deterministic-ish demo provider used whenever no real Vision API key is
 * configured. It "detects" a plausible handful of sticker numbers so the
 * full upload -> review -> save flow can be exercised end-to-end without
 * any external dependency. Seeded by the image size so the same photo
 * produces the same demo result across reloads.
 */
function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export class MockVisionProvider implements VisionProvider {
  name = "מצב הדגמה (ללא AI מחובר)";
  isMock = true;

  async scanDuplicates(imageBase64: string): Promise<DuplicateScanResult> {
    const rand = seededRandom(imageBase64.length || 42);
    const count = 5 + Math.floor(rand() * 8);
    const seen = new Set<number>();
    const detected = [];

    for (let i = 0; i < count; i++) {
      let number = 1 + Math.floor(rand() * 120);
      while (seen.has(number)) number = 1 + Math.floor(rand() * 120);
      seen.add(number);
      detected.push({ number, confidence: Math.round((0.68 + rand() * 0.31) * 100) / 100 });
    }

    return {
      detected: detected.sort((a, b) => a.number - b.number),
      isMock: true,
      notes:
        "זהו זיהוי הדגמה (Mock). כדי לחבר זיהוי אמיתי, הגדירו את משתנה הסביבה OPENAI_API_KEY - ראו src/lib/vision/openaiProvider.ts.",
    };
  }

  async scanAlbumPage(imageBase64: string): Promise<AlbumScanResult> {
    const rand = seededRandom((imageBase64.length || 42) * 7);
    const startNumber = 1 + Math.floor(rand() * 40) * 10;
    const slotCount = 12;
    const slots = Array.from({ length: slotCount }, (_, i) => ({
      number: startNumber + i,
      filled: rand() > 0.4,
      confidence: Math.round((0.7 + rand() * 0.29) * 100) / 100,
    }));

    return {
      slots,
      isMock: true,
      notes:
        "זהו זיהוי הדגמה (Mock) של עמוד אלבום. כדי לחבר זיהוי אמיתי, הגדירו את משתנה הסביבה OPENAI_API_KEY.",
    };
  }
}
