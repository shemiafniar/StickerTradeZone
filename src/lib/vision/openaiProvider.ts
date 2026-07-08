import type { BackScanResult, VisionProvider } from "@/lib/vision/types";

const DEFAULT_MODEL = "gpt-4o-mini";

async function callOpenAiVision(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL ?? DEFAULT_MODEL,
      response_format: { type: "json_object" },
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI Vision request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Unexpected OpenAI Vision response shape");
  return content;
}

/**
 * Real Vision provider backed by OpenAI's vision-capable chat completions
 * API. Only used when `OPENAI_API_KEY` is set (see getVisionProvider() in
 * ./index.ts) - otherwise the app falls back to MockVisionProvider so the
 * full scanner flow still works in local/dev/demo environments.
 */
export class OpenAiVisionProvider implements VisionProvider {
  name = "OpenAI Vision";
  isMock = false;

  async scanStickerBacks(imageBase64: string, mimeType: string): Promise<BackScanResult> {
    const prompt = `You are looking at a photo of several football/soccer sticker BACKS (the reverse side of the stickers) laid out on a surface.
Each sticker's back has a unique identifier printed in a top-right corner, made of a 3-letter country/team code followed by a number from 1 to 20, for example "GER 2", "FRA 17", "POR 5", "COL 19".
Identify every distinct sticker back you can read.
Respond ONLY with strict JSON of the shape:
{"detected": [{"teamCode": "<3-letter code>", "number": <integer 1-20>, "confidence": <0-1 float>}]}
If you cannot read an identifier confidently, still include your best guess with a lower confidence score. Do not invent stickers that clearly aren't present.`;

    const raw = await callOpenAiVision(imageBase64, mimeType, prompt);
    const parsed = JSON.parse(raw) as {
      detected?: { teamCode: string; number: number; confidence: number }[];
    };

    return {
      detected: (parsed.detected ?? [])
        .filter(
          (d) =>
            typeof d.teamCode === "string" &&
            /^[A-Za-z]{3}$/.test(d.teamCode) &&
            Number.isFinite(d.number) &&
            d.number >= 1 &&
            d.number <= 20
        )
        .map((d) => ({
          teamCode: d.teamCode.toUpperCase(),
          number: Math.round(d.number),
          confidence: Math.min(1, Math.max(0, d.confidence ?? 0.5)),
        })),
      isMock: false,
    };
  }
}
