"use server";

import { getVisionProvider, type BackScanResult } from "@/lib/vision";
import { VisionApiError, VisionParseError, VisionTimeoutError } from "@/lib/vision/errors";
import { createClient } from "@/lib/supabase/server";
import { formatRetrySeconds } from "@/lib/rateLimit";

export interface ScanActionState {
  error?: string;
  result?: BackScanResult;
  providerName?: string;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
// The client (ImageDropzone + resizeImageForUpload) always re-encodes to
// JPEG before upload, but this list stays broad server-side as a defensive
// backstop (e.g. a non-JS client, or a future upload path).
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const GENERIC_ERROR = "אירעה שגיאה בעיבוד התמונה. נסו שוב, ואם זה ממשיך לקרות נסו תמונה אחרת.";

// Scanning itself only reads/analyzes an image - it doesn't contact or
// affect any other user - so unlike trade requests/chat, suspended accounts
// are still allowed to use it (they can still curate their own collection).
async function requireAuth(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר מחדש" };
  return { userId: user.id };
}

async function checkAndLogScan(userId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("scan_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - SCAN_LIMIT.windowHours * 60 * 60 * 1000).toISOString());

  if ((count ?? 0) >= SCAN_LIMIT.max) {
    return {
      error: `הגעת למגבלת הסריקות (${SCAN_LIMIT.max} בשעה). נסו שוב בעוד ${formatRetrySeconds(3600)}.`,
    };
  }

  // Best-effort logging for the rate limit above - failing to log shouldn't
  // block the scan itself.
  const { error: insertError } = await supabase.from("scan_events").insert({ user_id: userId, mode: "sticker_backs" });
  if (insertError) {
    // Not fatal (see comment above) but worth knowing about server-side -
    // e.g. this is exactly how a drifted `scan_events.mode` check
    // constraint on a production database would show up.
    console.error("[scanner] scan_events insert failed (non-fatal):", insertError.message);
  }
  return {};
}

const SCAN_LIMIT = { max: 20, windowHours: 1 };

async function readImage(formData: FormData): Promise<{ base64: string; mimeType: string } | { error: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "נא לבחור תמונה" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "התמונה גדולה מדי (מקסימום 8MB). נסו לצלם שוב או לדחוס את התמונה." };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { error: "פורמט קובץ לא נתמך. יש להעלות תמונת JPG, PNG, WEBP או HEIC." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return { base64: buffer.toString("base64"), mimeType: file.type };
  } catch (err) {
    console.error("[scanner] Failed to read uploaded file:", err instanceof Error ? err.message : err);
    return { error: "לא ניתן היה לקרוא את קובץ התמונה. נסו קובץ אחר." };
  }
}

/**
 * Maps a caught error to a specific, useful Hebrew message where we can
 * reasonably tell what went wrong, falling back to a generic one -
 * "do not hide the issue behind a generic fallback" applies to *logging*,
 * not necessarily every possible message shown to the end user, some of
 * which (a raw network stack trace) would never be useful to a collector
 * trying to scan a sticker. The raw error is always logged server-side
 * first (see the call site), regardless of which message this returns.
 */
function toUserFacingScanError(err: unknown): string {
  if (err instanceof VisionTimeoutError) {
    return "הזיהוי החכם ארך זמן רב מהצפוי. נסו שוב, או עם תמונה עם פחות מדבקות.";
  }
  if (err instanceof VisionApiError) {
    if (err.status === 401 || err.status === 403) {
      return "שירות הזיהוי החכם אינו מוגדר כרגע כראוי. פנו לתמיכה.";
    }
    if (err.status === 429) {
      return "שירות הזיהוי החכם עמוס כרגע. נסו שוב בעוד כמה דקות.";
    }
    if (err.status && err.status >= 500) {
      return "שירות הזיהוי החכם אינו זמין כרגע. נסו שוב בעוד כמה דקות.";
    }
    return "לא ניתן היה לזהות את המדבקות בתמונה הזו. נסו תמונה ברורה וממוקדת יותר.";
  }
  if (err instanceof VisionParseError) {
    return "לא הצלחנו לפרש את תוצאת הזיהוי. נסו שוב עם תמונה ברורה יותר.";
  }
  return GENERIC_ERROR;
}

export async function scanStickerBacksAction(_prevState: ScanActionState, formData: FormData): Promise<ScanActionState> {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return { error: auth.error };

    const image = await readImage(formData);
    if ("error" in image) return { error: image.error };

    const rateLimit = await checkAndLogScan(auth.userId);
    if (rateLimit.error) return { error: rateLimit.error };

    const provider = getVisionProvider();

    try {
      const result = await provider.scanStickerBacks(image.base64, image.mimeType);
      return { result, providerName: provider.name };
    } catch (err) {
      // Log full technical detail server-side only - never the image data
      // itself, and never an API key (VisionApiError's message is
      // constructed without one - see openaiProvider.ts).
      console.error(
        `[scanner] Vision provider "${provider.name}" failed for user ${auth.userId}:`,
        err instanceof Error ? err.message : err
      );
      return { error: toUserFacingScanError(err) };
    }
  } catch (err) {
    // Belt-and-suspenders: whatever unexpectedly throws here (e.g. an auth
    // client failing to initialize), never let it become an uncaught
    // exception that surfaces the app's generic error boundary instead of
    // a real, actionable message.
    console.error("[scanner] Unexpected error in scanStickerBacksAction:", err instanceof Error ? err.message : err);
    return { error: GENERIC_ERROR };
  }
}
