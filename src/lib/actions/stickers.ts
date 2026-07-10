"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStickerCodeToIdMap } from "@/lib/data/stickers";
import { normalizeStickerCode } from "@/lib/stickerCodes";
import type { ListingType, UserSticker } from "@/types/database";

export interface StickerActionState {
  error?: string;
  success?: boolean;
  addedCount?: number;
}

function parseListingType(value: FormDataEntryValue | null): ListingType {
  return value === "sale" || value === "both" ? value : "trade";
}

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

export interface TeamGridCellUpdate {
  stickerId: string;
  /** null = unmarked (delete the row). 0 = missing. 1+ = owned, with (quantity-1) duplicates. */
  quantity: number | null;
}

/**
 * Batched save for a whole team's 20-sticker grid: taps only mutate local
 * client state (instant, no network per tap - see StickerGrid.tsx), and
 * this single action persists the full diff at once when the user presses
 * "שמירה". Cells set to null delete their row (gray = unmarked); any other
 * quantity is upserted, preserving prior listing_type/price/note if the row
 * already existed (only `quantity` is written here).
 */
export async function saveTeamGridAction(
  teamCode: string,
  cells: TeamGridCellUpdate[]
): Promise<StickerActionState> {
  try {
    const userId = await requireUserId();
    const supabase = await createClient();

    const toUpsert = cells.filter((c): c is TeamGridCellUpdate & { quantity: number } => c.quantity !== null);
    const toClear = cells.filter((c) => c.quantity === null).map((c) => c.stickerId);

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("user_stickers").upsert(
        toUpsert.map((c) => ({ user_id: userId, sticker_id: c.stickerId, quantity: c.quantity })),
        { onConflict: "user_id,sticker_id" }
      );
      if (error) return { error: error.message };
    }

    if (toClear.length > 0) {
      const { error } = await supabase
        .from("user_stickers")
        .delete()
        .eq("user_id", userId)
        .in("sticker_id", toClear);
      if (error) return { error: error.message };
    }

    revalidatePath(`/dashboard/stickers/${teamCode.toLowerCase()}`);
    revalidatePath("/dashboard/stickers");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/matches");
    return { success: true, addedCount: toUpsert.length };
  } catch {
    return { error: "יש להתחבר מחדש" };
  }
}

/**
 * Marks a batch of sticker codes (e.g. from the AI Scanner) as owned - sets
 * quantity to at least 1, without ever reducing an existing higher quantity
 * (owning spares is a stronger signal than plain ownership, so scanning
 * shouldn't silently remove a sticker's duplicate availability).
 */
export async function saveScannedStickersAsOwnedAction(codes: string[]): Promise<StickerActionState> {
  try {
    const userId = await requireUserId();
    const normalized = Array.from(
      new Set(codes.map((c) => normalizeStickerCode(c)).filter((c): c is string => Boolean(c)))
    );
    if (normalized.length === 0) return { error: "לא זוהו מדבקות תקינות" };

    const codeToId = await getStickerCodeToIdMap();
    const stickerIds = normalized.map((c) => codeToId.get(c)).filter((id): id is string => Boolean(id));
    if (stickerIds.length === 0) return { error: "המדבקות שזוהו לא נמצאות באלבום" };

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("user_stickers")
      .select("sticker_id, quantity")
      .eq("user_id", userId)
      .in("sticker_id", stickerIds);

    const existingQuantityById = new Map(
      ((existing as Pick<UserSticker, "sticker_id" | "quantity">[]) ?? []).map((e) => [e.sticker_id, e.quantity])
    );

    const rows = stickerIds
      .filter((id) => (existingQuantityById.get(id) ?? 0) < 1)
      .map((sticker_id) => ({ user_id: userId, sticker_id, quantity: 1 }));

    if (rows.length === 0) {
      return { success: true, addedCount: 0 };
    }

    const { error } = await supabase.from("user_stickers").upsert(rows, { onConflict: "user_id,sticker_id" });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/stickers");
    revalidatePath("/dashboard");
    return { success: true, addedCount: rows.length };
  } catch {
    return { error: "יש להתחבר מחדש" };
  }
}

export interface UpdateListingState {
  error?: string;
  success?: boolean;
}

/** Edits marketplace details (listing type / price / note) for a sticker that currently has at least one available duplicate. */
export async function updateDuplicateListingAction(
  _prevState: UpdateListingState,
  formData: FormData
): Promise<UpdateListingState> {
  try {
    const userId = await requireUserId();
    const id = String(formData.get("id") ?? "");
    const listingType = parseListingType(formData.get("listingType"));
    const priceRaw = String(formData.get("price") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    if (!id) return { error: "פריט לא תקין" };

    let price: number | null = null;
    if (priceRaw) {
      price = Number(priceRaw);
      if (!Number.isFinite(price) || price < 0) return { error: "מחיר לא תקין" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_stickers")
      .update({ listing_type: listingType, price, note: note || null })
      .eq("id", id)
      .eq("user_id", userId)
      .gte("quantity", 2);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/stickers/marketplace");
    revalidatePath("/dashboard/matches");
    return { success: true };
  } catch {
    return { error: "יש להתחבר מחדש" };
  }
}

/**
 * Removes a sticker's duplicate availability (reduces quantity back to 1,
 * i.e. "owned, no spares") without touching its owned status - unlike the
 * old status-based model, a duplicate is no longer a separate row that can
 * be deleted independently of ownership, so deleting the whole row here
 * would have incorrectly un-owned the sticker too. Used from the
 * marketplace editor's "✕" button.
 */
export async function removeDuplicateListingAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("user_stickers").update({ quantity: 1, price: null, note: null }).eq("id", id).eq("user_id", userId);
  revalidatePath("/dashboard/stickers/marketplace");
  revalidatePath("/dashboard/stickers");
  revalidatePath("/dashboard");
}
