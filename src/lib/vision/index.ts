import type { VisionProvider } from "@/lib/vision/types";
import { MockVisionProvider } from "@/lib/vision/mockProvider";
import { OpenAiVisionProvider } from "@/lib/vision/openaiProvider";

export * from "@/lib/vision/types";

/**
 * Single seam for selecting a Vision/OCR backend. Add a new provider by
 * implementing `VisionProvider` and returning it here (e.g. behind another
 * env var) - nothing else in the scanner feature needs to change.
 */
export function getVisionProvider(): VisionProvider {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAiVisionProvider();
  }
  return new MockVisionProvider();
}
