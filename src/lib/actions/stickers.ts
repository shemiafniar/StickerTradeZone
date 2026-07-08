"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStickerCodeToIdMap } from "@/lib/data/stickers";
import { normalizeStickerCode } from "@/lib/stickerCodes";
import type { ListingType, StickerStatus } from "@/types/database";

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
  status: "none" | StickerStatus;
}

/**
 * Batched save for a whole team's 20-sticker grid: taps only mutate local
 * client state (instant, no network per tap - see StickerGrid.tsx), and
 * this single action persists the full diff at once when the user presses
 * "שמירה". Cells set to "none" delete their row (gray = unmarked); any
 * other status is upserted, preserving prior listing_type/price/note if the
 * row already existed (only `status` is written here).
 */
export async function saveTeamGridAction(
  teamCode: string,
  cells: TeamGridCellUpdate[]
): Promise<StickerActionState> {
  try {
    const userId = await requireUserId();
    const supabase = await createClient();

    const toUpsert = cells.filter(
      (c): c is TeamGridCellUpdate & { status: StickerStatus } => c.status !== "none"
    );
    const toClear = cells.filter((c) => c.status === "none").map((c) => c.stickerId);

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("user_stickers").upsert(
        toUpsert.map((c) => ({ user_id: userId, sticker_id: c.stickerId, status: c.status })),
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
 * Marks a batch of sticker codes (e.g. from the AI Scanner) as "have"
 * (owned). Codes already marked "duplicate" are left untouched - owning a
 * spare is a stronger signal than plain ownership, so scanning shouldn't
 * silently remove a sticker from the marketplace.
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
      .select("sticker_id, status")
      .eq("user_id", userId)
      .in("sticker_id", stickerIds);

    const alreadyDuplicate = new Set(
      ((existing as { sticker_id: string; status: StickerStatus }[]) ?? [])
        .filter((e) => e.status === "duplicate")
        .map((e) => e.sticker_id)
    );

    const rows = stickerIds
      .filter((id) => !alreadyDuplicate.has(id))
      .map((sticker_id) => ({ user_id: userId, sticker_id, status: "have" as const }));

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

/** Edits marketplace details (listing type / price / note) for an existing duplicate. */
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
      .eq("status", "duplicate");

    if (error) return { error: error.message };

    revalidatePath("/dashboard/stickers/marketplace");
    revalidatePath("/dashboard/matches");
    return { success: true };
  } catch {
    return { error: "יש להתחבר מחדש" };
  }
}

/** Removes a single tradeable-duplicate listing without leaving the grid page (used from the marketplace editor). */
export async function removeDuplicateListingAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("user_stickers").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/dashboard/stickers/marketplace");
  revalidatePath("/dashboard/stickers");
  revalidatePath("/dashboard");
}
