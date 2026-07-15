import type { BackScanResult, VisionProvider } from "@/lib/vision/types";
import { VisionApiError, VisionParseError, VisionTimeoutError } from "@/lib/vision/errors";
import { isValidStickerNumberForTeam } from "@/lib/stickerCodes";

const DEFAULT_MODEL = "gpt-4o-mini";
// OpenAI Vision requests are usually done well within this, but a hung
// request should never be left to run until Vercel's own function timeout
// kills it with an opaque platform-level error - abort it ourselves first
// so scanStickerBacksAction can return a clear Hebrew message.
const VISION_TIMEOUT_MS = 25_000;

async function callOpenAiVision(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Should be unreachable in practice - getVisionProvider() only
    // constructs this class when OPENAI_API_KEY is set - but never throw a
    // message that could theoretically echo key-related details either way.
    throw new VisionApiError("OpenAI Vision provider constructed without an API key configured", 401);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
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
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new VisionTimeoutError();
    }
    // Network-level failure (DNS, connection refused, etc.) - never expose
    // the raw error (could theoretically contain request internals) to the
    // caller; the status-less VisionApiError still gets logged with real
    // detail by the caller before this message is shown to a user.
    throw new VisionApiError(`Network error calling OpenAI Vision: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Truncated and logged server-side only (see scanStickerBacksAction's
    // catch block) - never returned verbatim to the client.
    throw new VisionApiError(`OpenAI Vision request failed (${response.status}): ${body.slice(0, 300)}`, response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    throw new VisionParseError(`OpenAI Vision returned a non-JSON response: ${err instanceof Error ? err.message : err}`);
  }

  const content = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new VisionParseError("Unexpected OpenAI Vision response shape (missing choices[0].message.content)");
  }
  return content;
}

/**
 * GPT models occasionally wrap JSON in a markdown code fence
 * (```json ... ```) even when explicitly told to respond with raw JSON -
 * strip that before parsing rather than treating it as a hard failure.
 */
function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1] : trimmed;
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
If you cannot read an identifier confidently, still include your best guess with a lower confidence score. Do not invent stickers that clearly aren't present. If you see no sticker backs at all, respond with {"detected": []}.`;

    const raw = await callOpenAiVision(imageBase64, mimeType, prompt);

    let parsed: { detected?: { teamCode: string; number: number; confidence: number }[] };
    try {
      parsed = JSON.parse(stripMarkdownFence(raw));
    } catch (err) {
      throw new VisionParseError(
        `Failed to parse OpenAI Vision JSON content: ${err instanceof Error ? err.message : err}`
      );
    }

    return {
      detected: (parsed.detected ?? [])
        .filter(
          (d) =>
            d &&
            typeof d.teamCode === "string" &&
            /^[A-Za-z]{3}$/.test(d.teamCode) &&
            Number.isFinite(d.number) &&
            isValidStickerNumberForTeam(d.teamCode, Math.round(d.number))
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
