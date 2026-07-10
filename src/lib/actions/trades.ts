"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStickerCodeToIdMap } from "@/lib/data/stickers";
import { parseStickerCodes } from "@/lib/stickerCodes";
import { formatRetrySeconds } from "@/lib/rateLimit";
import { hasDuplicateAvailable } from "@/lib/collectionStatus";
import type { Profile, UserSticker } from "@/types/database";

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

  // A collector can only offer stickers they actually have an available
  // duplicate of - never their only owned copy (requirement: "a user can
  // offer only available duplicate copies, not their only owned copy").
  // Validated here, at proposal time, against *my* current quantities; the
  // matching completion RPC re-validates atomically at completion time too,
  // since availability can change in between.
  if (giveCodes.length > 0) {
    const giveIds = giveCodes.map((c) => codeToId.get(c)).filter((id): id is string => Boolean(id));
    const { data: myStickers } = await supabase
      .from("user_stickers")
      .select("sticker_id, quantity")
      .eq("user_id", user.id)
      .in("sticker_id", giveIds);

    const myQuantityByStickerId = new Map(
      ((myStickers as Pick<UserSticker, "sticker_id" | "quantity">[]) ?? []).map((s) => [s.sticker_id, s.quantity])
    );

    const insufficient = giveCodes.filter((code) => {
      const stickerId = codeToId.get(code);
      const quantity = stickerId ? myQuantityByStickerId.get(stickerId) ?? 0 : 0;
      return !hasDuplicateAvailable(quantity);
    });

    if (insufficient.length > 0) {
      return {
        error: `אין לך כפולות זמינות להצעה של: ${insufficient.join(", ")}. ניתן להציע רק מדבקות שיש לכם מהן יותר מעותק אחד.`,
      };
    }
  }

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
      .map((sticker_id) => ({ trade_request_id: trade.id, sticker_id, direction: "give" as const, quantity: 1 })),
    ...receiveCodes
      .map((c) => codeToId.get(c))
      .filter((id): id is string => Boolean(id))
      .map((sticker_id) => ({ trade_request_id: trade.id, sticker_id, direction: "receive" as const, quantity: 1 })),
  ];

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("trade_request_items").insert(items);
    if (itemsError) return { error: itemsError.message };
  }

  // Best-effort onboarding-journey signal (backs the dashboard checklist) -
  // never blocks trade creation if it fails.
  if (!(myProfile as Profile | null)?.first_trade_started_at) {
    const { error: markError } = await supabase
      .from("profiles")
      .update({ first_trade_started_at: new Date().toISOString() })
      .eq("id", user.id);
    if (markError) console.error("[trades] Failed to record first_trade_started_at:", markError.message);
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
  if (message.includes("insufficient available duplicates")) {
    return "לא ניתן להשלים את הטרייד - אחד הצדדים כבר לא מחזיק בכמות הכפולות הדרושה. בדקו את האוסף שלכם ונסו שוב.";
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

  if (status === "completed") {
    // Atomic, quantity-safe completion: exchanges every trade_request_item's
    // quantity between the two participants and marks the trade completed
    // in a single transaction (see complete_trade_request() in
    // 0017_quantity_and_groups.sql) - a plain status UPDATE never touched
    // either side's actual collection.
    const { error } = await supabase.rpc("complete_trade_request", { p_trade_id: tradeId });
    if (error) return { error: translateTradeError(error.message) };
  } else {
    const { error } = await supabase.from("trade_requests").update({ status }).eq("id", tradeId);
    if (error) return { error: translateTradeError(error.message) };
  }

  revalidatePath("/dashboard/trades");
  revalidatePath(`/dashboard/trades/${tradeId}`);
  revalidatePath("/dashboard/stickers");
  revalidatePath("/dashboard");
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
