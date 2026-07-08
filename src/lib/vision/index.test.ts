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
    const duplicateResult = await provider.scanDuplicates("fake-base64-data", "image/jpeg");
    expect(duplicateResult.isMock).toBe(true);
    expect(duplicateResult.detected.length).toBeGreaterThan(0);
    for (const d of duplicateResult.detected) {
      expect(d.number).toBeGreaterThan(0);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }

    const albumResult = await provider.scanAlbumPage("fake-base64-data", "image/jpeg");
    expect(albumResult.isMock).toBe(true);
    expect(albumResult.slots.length).toBeGreaterThan(0);
  });

  it("produces a stable result for the same input length", async () => {
    const provider = new MockVisionProvider();
    const a = await provider.scanDuplicates("x".repeat(100), "image/jpeg");
    const b = await provider.scanDuplicates("x".repeat(100), "image/jpeg");
    expect(a.detected).toEqual(b.detected);
  });
});
