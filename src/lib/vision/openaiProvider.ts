import type { AlbumScanResult, DuplicateScanResult, VisionProvider } from "@/lib/vision/types";

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
      max_tokens: 1000,
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

  async scanDuplicates(imageBase64: string, mimeType: string): Promise<DuplicateScanResult> {
    const prompt = `You are looking at a photo of several loose football/soccer sticker album cards laid out on a surface.
Each sticker has a printed number (usually small, in a corner or on an edge).
Identify every distinct sticker number you can read.
Respond ONLY with strict JSON of the shape:
{"detected": [{"number": <integer>, "confidence": <0-1 float>}]}
If you cannot read a number confidently, still include your best guess with a lower confidence score. Do not invent stickers that clearly aren't present.`;

    const raw = await callOpenAiVision(imageBase64, mimeType, prompt);
    const parsed = JSON.parse(raw) as { detected?: { number: number; confidence: number }[] };

    return {
      detected: (parsed.detected ?? [])
        .filter((d) => Number.isFinite(d.number) && d.number > 0)
        .map((d) => ({ number: Math.round(d.number), confidence: Math.min(1, Math.max(0, d.confidence ?? 0.5)) })),
      isMock: false,
    };
  }

  async scanAlbumPage(imageBase64: string, mimeType: string): Promise<AlbumScanResult> {
    const prompt = `You are looking at a photo of an open football/soccer sticker album page.
Each slot on the page has a printed number. A slot is "filled" if a sticker is placed over it, and "empty" if the printed slot outline/number is still visible with no sticker on it.
Identify every slot number you can read and whether it is filled or empty.
Respond ONLY with strict JSON of the shape:
{"slots": [{"number": <integer>, "filled": <boolean>, "confidence": <0-1 float>}]}`;

    const raw = await callOpenAiVision(imageBase64, mimeType, prompt);
    const parsed = JSON.parse(raw) as { slots?: { number: number; filled: boolean; confidence: number }[] };

    return {
      slots: (parsed.slots ?? [])
        .filter((s) => Number.isFinite(s.number) && s.number > 0)
        .map((s) => ({
          number: Math.round(s.number),
          filled: Boolean(s.filled),
          confidence: Math.min(1, Math.max(0, s.confidence ?? 0.5)),
        })),
      isMock: false,
    };
  }
}
