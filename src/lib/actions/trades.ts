"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStickerCodeToIdMap } from "@/lib/data/stickers";
import { parseStickerCodes } from "@/lib/stickerCodes";
import { formatRetrySeconds } from "@/lib/rateLimit";
import type { Profile } from "@/types/database";

export interface TradeActionState {
  error?: string;
  success?: boolean;
}

// DB-backed (accurate across serverless instances) rate limit: counts real
// rows rather than relying on in-process memory.
const TRADE_REQUEST_LIMIT = { max: 20, windowHours: 1 };

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

  const [{ data: myProfile }, { data: targetProfile }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", toUserId).maybeSingle(),
  ]);

  if ((myProfile as Profile | null)?.status === "suspended") {
    return { error: "החשבון שלך מושהה ולא ניתן לשלוח בקשות טרייד. פנו לתמיכה לפרטים." };
  }
  if (!targetProfile || (targetProfile as Profile).status !== "active") {
    return { error: "לא ניתן לשלוח בקשת טרייד לאספן/ית זה/זו כרגע" };
  }

  const { count: recentCount } = await supabase
    .from("trade_requests")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", user.id)
    .gte("created_at", new Date(Date.now() - TRADE_REQUEST_LIMIT.windowHours * 60 * 60 * 1000).toISOString());

  if ((recentCount ?? 0) >= TRADE_REQUEST_LIMIT.max) {
    return {
      error: `שלחת יותר מדי בקשות טרייד (${TRADE_REQUEST_LIMIT.max} בשעה). נסו שוב בעוד ${formatRetrySeconds(3600)}.`,
    };
  }

  const giveCodes = parseStickerCodes(giveInput);
  const receiveCodes = parseStickerCodes(receiveInput);

  if (giveCodes.length === 0 && receiveCodes.length === 0) {
    return { error: "נא לבחור לפחות מדבקה אחת להצעה" };
  }

  const codeToId = await getStickerCodeToIdMap();

  const { data: trade, error: tradeError } = await supabase
    .from("trade_requests")
    .insert({ from_user_id: user.id, to_user_id: toUserId, message: message || null })
    .select("*")
    .single();

  if (tradeError || !trade) {
    return { error: tradeError?.message ?? "שגיאה ביצירת בקשת הטרייד" };
  }

  const items = [
    ...giveCodes
      .map((c) => codeToId.get(c))
      .filter((id): id is string => Boolean(id))
      .map((sticker_id) => ({ trade_request_id: trade.id, sticker_id, direction: "give" as const })),
    ...receiveCodes
      .map((c) => codeToId.get(c))
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

function translateTradeError(message: string): string {
  if (message.includes("only the recipient can accept or decline")) {
    return "רק מי שקיבל את הבקשה יכול לאשר או לדחות אותה";
  }
  if (message.includes("only the sender can cancel")) {
    return "רק מי ששלח את הבקשה יכול לבטל אותה";
  }
  if (message.includes("only a trade participant")) {
    return "רק צד לעסקה יכול לעדכן אותה";
  }
  if (message.includes("suspended") || message.includes("is_active_user")) {
    return "לא ניתן לבצע פעולה זו כרגע - החשבון מושהה";
  }
  if (message.includes("invalid trade status transition")) {
    return "לא ניתן לבצע את הפעולה במצב הנוכחי של הבקשה";
  }
  return message;
}

// Exported so useActionState (a client hook) can drive these buttons and
// surface any error - RLS/trigger rejections were previously silently
// swallowed because these were plain void form actions.
async function updateTradeStatus(
  _prevState: TradeActionState,
  formData: FormData,
  status: "accepted" | "declined" | "completed" | "cancelled"
): Promise<TradeActionState> {
  const tradeId = String(formData.get("tradeId") ?? "");
  if (!tradeId) return { error: "בקשת טרייד לא תקינה" };

  const supabase = await createClient();
  const { error } = await supabase.from("trade_requests").update({ status }).eq("id", tradeId);

  if (error) return { error: translateTradeError(error.message) };

  revalidatePath("/dashboard/trades");
  revalidatePath(`/dashboard/trades/${tradeId}`);
  return { success: true };
}

export async function acceptTradeAction(prevState: TradeActionState, formData: FormData): Promise<TradeActionState> {
  return updateTradeStatus(prevState, formData, "accepted");
}

export async function declineTradeAction(prevState: TradeActionState, formData: FormData): Promise<TradeActionState> {
  return updateTradeStatus(prevState, formData, "declined");
}

export async function completeTradeAction(prevState: TradeActionState, formData: FormData): Promise<TradeActionState> {
  return updateTradeStatus(prevState, formData, "completed");
}

export async function cancelTradeAction(prevState: TradeActionState, formData: FormData): Promise<TradeActionState> {
  return updateTradeStatus(prevState, formData, "cancelled");
}
