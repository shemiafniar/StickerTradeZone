import type { BackScanResult, DetectedStickerBack, VisionProvider } from "@/lib/vision/types";

/**
 * Deterministic-ish demo provider used whenever no real Vision API key is
 * configured. It "detects" a plausible handful of sticker backs so the full
 * upload -> review -> save flow can be exercised end-to-end without any
 * external dependency. Seeded by the image size so the same photo produces
 * the same demo result across reloads.
 *
 * The team codes here are a representative sample of the catalog seeded in
 * supabase/migrations/0011_shashot_teams.sql - kept as a small self-contained
 * list (rather than a DB lookup) so this provider has no dependencies, same
 * as the rest of the module.
 */
const DEMO_TEAM_CODES = [
  "ISR",
  "BRA",
  "ARG",
  "FRA",
  "GER",
  "ESP",
  "POR",
  "ENG",
  "ITA",
  "NED",
  "BEL",
  "CRO",
  "URU",
  "COL",
  "MEX",
  "USA",
  "JPN",
  "MAR",
];

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

  async scanStickerBacks(imageBase64: string): Promise<BackScanResult> {
    const rand = seededRandom(imageBase64.length || 42);
    const count = 5 + Math.floor(rand() * 8);
    const seen = new Set<string>();
    const detected: DetectedStickerBack[] = [];

    let attempts = 0;
    while (detected.length < count && attempts < 500) {
      attempts++;
      const teamCode = DEMO_TEAM_CODES[Math.floor(rand() * DEMO_TEAM_CODES.length)];
      const number = 1 + Math.floor(rand() * 20);
      const key = `${teamCode}-${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      detected.push({ teamCode, number, confidence: Math.round((0.68 + rand() * 0.31) * 100) / 100 });
    }

    return {
      detected: detected.sort((a, b) =>
        a.teamCode === b.teamCode ? a.number - b.number : a.teamCode.localeCompare(b.teamCode)
      ),
      isMock: true,
      notes:
        "זהו זיהוי הדגמה (Mock). כדי לחבר זיהוי אמיתי, הגדירו את משתנה הסביבה OPENAI_API_KEY - ראו src/lib/vision/openaiProvider.ts.",
    };
  }
}
