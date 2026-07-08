"use server";

import { getVisionProvider, type AlbumScanResult, type DuplicateScanResult } from "@/lib/vision";
import { createClient } from "@/lib/supabase/server";

export interface ScanActionState {
  error?: string;
  duplicateResult?: DuplicateScanResult;
  albumResult?: AlbumScanResult;
  providerName?: string;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
}

async function readImage(formData: FormData): Promise<{ base64: string; mimeType: string } | { error: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "נא לבחור תמונה" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "התמונה גדולה מדי (מקסימום 8MB)" };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "יש להעלות קובץ תמונה" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType: file.type };
}

export async function scanDuplicatesAction(
  _prevState: ScanActionState,
  formData: FormData
): Promise<ScanActionState> {
  try {
    await requireAuth();
  } catch {
    return { error: "יש להתחבר מחדש" };
  }

  const image = await readImage(formData);
  if ("error" in image) return { error: image.error };

  const provider = getVisionProvider();
  try {
    const duplicateResult = await provider.scanDuplicates(image.base64, image.mimeType);
    return { duplicateResult, providerName: provider.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "שגיאה בעיבוד התמונה" };
  }
}

export async function scanAlbumPageAction(
  _prevState: ScanActionState,
  formData: FormData
): Promise<ScanActionState> {
  try {
    await requireAuth();
  } catch {
    return { error: "יש להתחבר מחדש" };
  }

  const image = await readImage(formData);
  if ("error" in image) return { error: image.error };

  const provider = getVisionProvider();
  try {
    const albumResult = await provider.scanAlbumPage(image.base64, image.mimeType);
    return { albumResult, providerName: provider.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "שגיאה בעיבוד התמונה" };
  }
}
