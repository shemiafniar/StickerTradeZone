import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { VisionApiError, VisionParseError } from "@/lib/vision/errors";
import { OpenAiVisionProvider } from "@/lib/vision/openaiProvider";

function openAiResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

describe("OpenAiVisionProvider", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key-not-real";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it("parses a well-formed strict-JSON response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => openAiResponse(JSON.stringify({ detected: [{ teamCode: "ger", number: 2, confidence: 0.8 }] })),
    }) as unknown as typeof fetch;

    const provider = new OpenAiVisionProvider();
    const result = await provider.scanStickerBacks("base64data", "image/jpeg");

    expect(result.detected).toEqual([{ teamCode: "GER", number: 2, confidence: 0.8 }]);
  });

  it("still parses correctly when the model wraps JSON in a markdown code fence", async () => {
    const fenced = "```json\n" + JSON.stringify({ detected: [{ teamCode: "FRA", number: 17, confidence: 0.95 }] }) + "\n```";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => openAiResponse(fenced),
    }) as unknown as typeof fetch;

    const provider = new OpenAiVisionProvider();
    const result = await provider.scanStickerBacks("base64data", "image/jpeg");

    expect(result.detected).toEqual([{ teamCode: "FRA", number: 17, confidence: 0.95 }]);
  });

  it("filters out malformed detections instead of throwing (e.g. an out-of-range number or non-3-letter code)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        openAiResponse(
          JSON.stringify({
            detected: [
              { teamCode: "GER", number: 2, confidence: 0.8 },
              { teamCode: "TOOLONG", number: 5, confidence: 0.5 },
              { teamCode: "FRA", number: 99, confidence: 0.5 },
            ],
          })
        ),
    }) as unknown as typeof fetch;

    const provider = new OpenAiVisionProvider();
    const result = await provider.scanStickerBacks("base64data", "image/jpeg");

    expect(result.detected).toEqual([{ teamCode: "GER", number: 2, confidence: 0.8 }]);
  });

  it("returns an empty detected list (not an error) when the model reports no stickers", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => openAiResponse(JSON.stringify({ detected: [] })),
    }) as unknown as typeof fetch;

    const provider = new OpenAiVisionProvider();
    const result = await provider.scanStickerBacks("base64data", "image/jpeg");

    expect(result.detected).toEqual([]);
  });

  it("throws VisionParseError (not a generic Error) on genuinely malformed JSON content", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => openAiResponse("this is not json at all"),
    }) as unknown as typeof fetch;

    const provider = new OpenAiVisionProvider();

    await expect(provider.scanStickerBacks("base64data", "image/jpeg")).rejects.toBeInstanceOf(VisionParseError);
  });

  it("throws VisionApiError with the HTTP status on a non-2xx response, without leaking the API key", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Incorrect API key provided",
    }) as unknown as typeof fetch;

    const provider = new OpenAiVisionProvider();

    try {
      await provider.scanStickerBacks("base64data", "image/jpeg");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(VisionApiError);
      expect((err as VisionApiError).status).toBe(401);
      expect((err as Error).message).not.toContain("sk-test-key-not-real");
    }
  });
});
