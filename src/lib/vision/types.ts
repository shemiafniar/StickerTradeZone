/**
 * Vision/OCR provider abstraction for the AI Sticker Scanner.
 *
 * Swapping providers (mock -> OpenAI -> Google Vision -> a custom in-house
 * model, etc.) only requires implementing this interface and wiring it up
 * in `getVisionProvider()` (src/lib/vision/index.ts) - no other app code
 * needs to change.
 */

export interface DetectedSticker {
  /** the sticker number as read from the photo */
  number: number;
  /** 0-1 confidence that this reading is correct */
  confidence: number;
}

export interface DuplicateScanResult {
  detected: DetectedSticker[];
  /** true when a mock/simulated provider produced this result */
  isMock: boolean;
  notes?: string;
}

export interface AlbumSlot {
  number: number;
  filled: boolean;
  confidence: number;
}

export interface AlbumScanResult {
  slots: AlbumSlot[];
  isMock: boolean;
  notes?: string;
}

export interface VisionProvider {
  /** short id shown in the UI, e.g. "מצב הדגמה" or "OpenAI Vision" */
  name: string;
  isMock: boolean;
  /** photo of several loose duplicate stickers -> detected sticker numbers */
  scanDuplicates(imageBase64: string, mimeType: string): Promise<DuplicateScanResult>;
  /** photo of an open album page -> which printed slots are filled vs empty */
  scanAlbumPage(imageBase64: string, mimeType: string): Promise<AlbumScanResult>;
}
