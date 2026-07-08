"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStickerNumberToIdMap } from "@/lib/data/stickers";
import { parseStickerNumbers } from "@/lib/stickerInput";

export interface TradeActionState {
  error?: string;
  success?: boolean;
}

export async function createTradeRequestAction(
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר מחדש" };

  const toUserId = String(formData.get("toUserId") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const giveInput = String(formData.get("give") ?? "");
  const receiveInput = String(formData.get("receive") ?? "");

  if (!toUserId || toUserId === user.id) {
    return { error: "בקשת טרייד לא תקינה" };
  }

  const giveNumbers = parseStickerNumbers(giveInput);
  const receiveNumbers = parseStickerNumbers(receiveInput);

  if (giveNumbers.length === 0 && receiveNumbers.length === 0) {
    return { error: "נא לבחור לפחות מדבקה אחת להצעה" };
  }

  const numberToId = await getStickerNumberToIdMap();

  const { data: trade, error: tradeError } = await supabase
    .from("trade_requests")
    .insert({ from_user_id: user.id, to_user_id: toUserId, message: message || null })
    .select("*")
    .single();

  if (tradeError || !trade) {
    return { error: tradeError?.message ?? "שגיאה ביצירת בקשת הטרייד" };
  }

  const items = [
    ...giveNumbers
      .map((n) => numberToId.get(n))
      .filter((id): id is string => Boolean(id))
      .map((sticker_id) => ({ trade_request_id: trade.id, sticker_id, direction: "give" as const })),
    ...receiveNumbers
      .map((n) => numberToId.get(n))
      .filter((id): id is string => Boolean(id))
      .map((sticker_id) => ({ trade_request_id: trade.id, sticker_id, direction: "receive" as const })),
  ];

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("trade_request_items").insert(items);
    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath("/dashboard/trades");
  redirect(`/dashboard/trades/${trade.id}`);
}

async function updateTradeStatus(
  tradeId: string,
  status: "accepted" | "declined" | "completed" | "cancelled"
): Promise<TradeActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("trade_requests").update({ status }).eq("id", tradeId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/trades");
  revalidatePath(`/dashboard/trades/${tradeId}`);
  return { success: true };
}

export async function acceptTradeAction(formData: FormData): Promise<void> {
  const tradeId = String(formData.get("tradeId") ?? "");
  if (tradeId) await updateTradeStatus(tradeId, "accepted");
}

export async function declineTradeAction(formData: FormData): Promise<void> {
  const tradeId = String(formData.get("tradeId") ?? "");
  if (tradeId) await updateTradeStatus(tradeId, "declined");
}

export async function completeTradeAction(formData: FormData): Promise<void> {
  const tradeId = String(formData.get("tradeId") ?? "");
  if (tradeId) await updateTradeStatus(tradeId, "completed");
}

export async function cancelTradeAction(formData: FormData): Promise<void> {
  const tradeId = String(formData.get("tradeId") ?? "");
  if (tradeId) await updateTradeStatus(tradeId, "cancelled");
}
