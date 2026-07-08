"use server";

import { getVisionProvider, type AlbumScanResult, type DuplicateScanResult } from "@/lib/vision";
import { createClient } from "@/lib/supabase/server";
import { formatRetrySeconds } from "@/lib/rateLimit";

export interface ScanActionState {
  error?: string;
  duplicateResult?: DuplicateScanResult;
  albumResult?: AlbumScanResult;
  providerName?: string;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// DB-backed (accurate across serverless instances). Vision API calls cost
// real money once a real provider is configured, so this limit matters even
// though the mock provider is free.
const SCAN_LIMIT = { max: 20, windowHours: 1 };

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

async function checkAndLogScan(userId: string, mode: "duplicates" | "album"): Promise<{ error?: string }> {
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
  await supabase.from("scan_events").insert({ user_id: userId, mode });
  return {};
}

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

  const buffer = Buffer.from(await file.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType: file.type };
}

export async function scanDuplicatesAction(
  _prevState: ScanActionState,
  formData: FormData
): Promise<ScanActionState> {
  const auth = await requireAuth();
  if ("error" in auth) return { error: auth.error };

  const image = await readImage(formData);
  if ("error" in image) return { error: image.error };

  const rateLimit = await checkAndLogScan(auth.userId, "duplicates");
  if (rateLimit.error) return { error: rateLimit.error };

  const provider = getVisionProvider();
  try {
    const duplicateResult = await provider.scanDuplicates(image.base64, image.mimeType);
    return { duplicateResult, providerName: provider.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "שגיאה בעיבוד התמונה. נסו שוב עם תמונה אחרת." };
  }
}

export async function scanAlbumPageAction(
  _prevState: ScanActionState,
  formData: FormData
): Promise<ScanActionState> {
  const auth = await requireAuth();
  if ("error" in auth) return { error: auth.error };

  const image = await readImage(formData);
  if ("error" in image) return { error: image.error };

  const rateLimit = await checkAndLogScan(auth.userId, "album");
  if (rateLimit.error) return { error: rateLimit.error };

  const provider = getVisionProvider();
  try {
    const albumResult = await provider.scanAlbumPage(image.base64, image.mimeType);
    return { albumResult, providerName: provider.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "שגיאה בעיבוד התמונה. נסו שוב עם תמונה אחרת." };
  }
}
