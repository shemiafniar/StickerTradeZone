"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseStickerNumbers } from "@/lib/stickerInput";
import { getAppSettings, getStickerNumberToIdMap } from "@/lib/data/stickers";

export interface StickerActionState {
  error?: string;
  success?: boolean;
  addedCount?: number;
}

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

export async function bulkAddDuplicatesAction(
  _prevState: StickerActionState,
  formData: FormData
): Promise<StickerActionState> {
  try {
    const userId = await requireUserId();
    const input = String(formData.get("numbers") ?? "");
    const forSale = formData.get("forSale") === "on";
    const settings = await getAppSettings();
    const numbers = parseStickerNumbers(input, settings.total_stickers || undefined);

    if (numbers.length === 0) return { error: "לא זוהו מספרי מדבקות תקינים" };

    const numberToId = await getStickerNumberToIdMap();
    const rows = numbers
      .map((n) => numberToId.get(n))
      .filter((id): id is string => Boolean(id))
      .map((sticker_id) => ({ user_id: userId, sticker_id, for_sale: forSale }));

    if (rows.length === 0) return { error: "מספרי המדבקות לא נמצאים באלבום" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_duplicates")
      .upsert(rows, { onConflict: "user_id,sticker_id" });

    if (error) return { error: error.message };

    revalidatePath("/dashboard/stickers");
    revalidatePath("/dashboard");
    return { success: true, addedCount: rows.length };
  } catch {
    return { error: "יש להתחבר מחדש" };
  }
}

export async function bulkAddMissingAction(
  _prevState: StickerActionState,
  formData: FormData
): Promise<StickerActionState> {
  try {
    const userId = await requireUserId();
    const input = String(formData.get("numbers") ?? "");
    const settings = await getAppSettings();
    const numbers = parseStickerNumbers(input, settings.total_stickers || undefined);

    if (numbers.length === 0) return { error: "לא זוהו מספרי מדבקות תקינים" };

    const numberToId = await getStickerNumberToIdMap();
    const rows = numbers
      .map((n) => numberToId.get(n))
      .filter((id): id is string => Boolean(id))
      .map((sticker_id) => ({ user_id: userId, sticker_id }));

    if (rows.length === 0) return { error: "מספרי המדבקות לא נמצאים באלבום" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_missing")
      .upsert(rows, { onConflict: "user_id,sticker_id" });

    if (error) return { error: error.message };

    revalidatePath("/dashboard/stickers");
    revalidatePath("/dashboard");
    return { success: true, addedCount: rows.length };
  } catch {
    return { error: "יש להתחבר מחדש" };
  }
}

export async function removeDuplicateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("user_duplicates").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/dashboard/stickers");
  revalidatePath("/dashboard");
}

export async function removeMissingAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("user_missing").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/dashboard/stickers");
  revalidatePath("/dashboard");
}

export async function toggleForSaleAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const forSale = formData.get("forSale") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("user_duplicates").update({ for_sale: !forSale }).eq("id", id).eq("user_id", userId);
  revalidatePath("/dashboard/stickers");
}

export async function moveMissingToHaveAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const missingId = String(formData.get("missingId") ?? "");
  const stickerId = String(formData.get("stickerId") ?? "");
  if (!missingId || !stickerId) return;

  const supabase = await createClient();
  await supabase.from("user_missing").delete().eq("id", missingId).eq("user_id", userId);
  await supabase
    .from("user_duplicates")
    .upsert({ user_id: userId, sticker_id: stickerId, for_sale: false }, { onConflict: "user_id,sticker_id" });

  revalidatePath("/dashboard/stickers");
  revalidatePath("/dashboard");
}
