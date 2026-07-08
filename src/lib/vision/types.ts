/**
 * Vision/OCR provider abstraction for the AI Sticker Scanner.
 *
 * The scanner reads the BACK of stickers, where every sticker prints a
 * unique identifier (3-letter team code + in-team number, e.g. "GER 2",
 * "FRA 17") in a top-right corner. Swapping providers (mock -> OpenAI ->
 * Google Vision -> a custom in-house model, etc.) only requires
 * implementing this interface and wiring it up in `getVisionProvider()`
 * (src/lib/vision/index.ts) - no other app code needs to change.
 */

export interface DetectedStickerBack {
  /** 3-letter team code as read from the photo, e.g. "GER" */
  teamCode: string;
  /** in-team sticker number as read from the photo, 1-20 */
  number: number;
  /** 0-1 confidence that this reading is correct */
  confidence: number;
}

export interface BackScanResult {
  detected: DetectedStickerBack[];
  /** true when a mock/simulated provider produced this result */
  isMock: boolean;
  notes?: string;
}

export interface VisionProvider {
  /** short id shown in the UI, e.g. "מצב הדגמה" or "OpenAI Vision" */
  name: string;
  isMock: boolean;
  /** photo of several sticker backs (each showing "TEAMCODE number") -> detected team+number pairs */
  scanStickerBacks(imageBase64: string, mimeType: string): Promise<BackScanResult>;
}
