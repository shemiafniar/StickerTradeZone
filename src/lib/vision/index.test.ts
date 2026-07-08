import { afterEach, describe, expect, it } from "vitest";
import { getVisionProvider } from "@/lib/vision";
import { MockVisionProvider } from "@/lib/vision/mockProvider";
import { OpenAiVisionProvider } from "@/lib/vision/openaiProvider";

const originalKey = process.env.OPENAI_API_KEY;

describe("getVisionProvider", () => {
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it("falls back to the mock provider when OPENAI_API_KEY is not set", () => {
    delete process.env.OPENAI_API_KEY;
    expect(getVisionProvider()).toBeInstanceOf(MockVisionProvider);
  });

  it("falls back to the mock provider when OPENAI_API_KEY is an empty string", () => {
    process.env.OPENAI_API_KEY = "";
    expect(getVisionProvider()).toBeInstanceOf(MockVisionProvider);
  });

  it("uses the OpenAI provider when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    expect(getVisionProvider()).toBeInstanceOf(OpenAiVisionProvider);
  });
});

describe("MockVisionProvider", () => {
  it("never calls any network API and always returns a result", async () => {
    const provider = new MockVisionProvider();
    const result = await provider.scanStickerBacks("fake-base64-data", "image/jpeg");
    expect(result.isMock).toBe(true);
    expect(result.detected.length).toBeGreaterThan(0);
    for (const d of result.detected) {
      expect(d.teamCode).toMatch(/^[A-Z]{3}$/);
      expect(d.number).toBeGreaterThanOrEqual(1);
      expect(d.number).toBeLessThanOrEqual(20);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("does not produce duplicate team+number pairs", async () => {
    const provider = new MockVisionProvider();
    const result = await provider.scanStickerBacks("x".repeat(100), "image/jpeg");
    const keys = result.detected.map((d) => `${d.teamCode}-${d.number}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("produces a stable result for the same input length", async () => {
    const provider = new MockVisionProvider();
    const a = await provider.scanStickerBacks("x".repeat(100), "image/jpeg");
    const b = await provider.scanStickerBacks("x".repeat(100), "image/jpeg");
    expect(a.detected).toEqual(b.detected);
  });
});
