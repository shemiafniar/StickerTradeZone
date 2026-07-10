/**
 * Client-only image preprocessing for the AI Scanner upload flow.
 *
 * Resizes/re-encodes every selected photo to a modest JPEG before it's ever
 * attached to the upload form. This solves three real production problems
 * at once:
 *
 * 1. Body size: Next.js's Server Action request body limit (see
 *    next.config.ts) and Vercel's own function payload limits are both
 *    finite - a raw 8-12MB phone photo is a real risk of exceeding either.
 *    A photo downscaled to ~1600px on its longest side and re-encoded as
 *    JPEG is almost always well under 1MB, regardless of the original.
 * 2. HEIC support: iOS's default camera format (HEIC) isn't accepted by
 *    OpenAI's Vision API. Rather than needing a server-side HEIC decoder
 *    (unreliable in a serverless/Vercel runtime - see README), this uses
 *    `createImageBitmap()`, which iOS/Safari can decode HEIC through
 *    natively (the OS-level image codec, not a JS/WASM implementation) -
 *    then re-encodes to JPEG via <canvas>. Browsers that can't decode HEIC
 *    (most non-Apple browsers) get a clear, specific error instead of a
 *    silent failure later in the pipeline.
 * 3. Consistency: every image the backend ever receives from this flow is
 *    already a modest, valid JPEG - no need for a format matrix of
 *    edge cases server-side.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export class ImageProcessingError extends Error {}

export async function resizeImageForUpload(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const isHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    throw new ImageProcessingError(
      isHeic
        ? "הדפדפן הזה לא הצליח לפתוח את קובץ ה-HEIC. נסו לצלם דרך המצלמה באתר, או להעביר את התמונה לפורמט JPG לפני ההעלאה."
        : "לא ניתן היה לפתוח את התמונה. נסו קובץ אחר."
    );
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageProcessingError("שגיאה בעיבוד התמונה בדפדפן זה. נסו דפדפן אחר.");

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new ImageProcessingError("שגיאה בעיבוד התמונה בדפדפן זה. נסו דפדפן אחר.");

    return new File([blob], toJpgFileName(file.name), { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

function toJpgFileName(originalName: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, "").trim();
  return `${base || "photo"}.jpg`;
}
