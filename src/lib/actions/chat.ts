"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatRetrySeconds } from "@/lib/rateLimit";
import type { Profile } from "@/types/database";

export interface ChatActionState {
  error?: string;
}

// DB-backed rate limit (accurate across serverless instances): counts real
// messages sent recently by this user, across all their trades.
const CHAT_MESSAGE_LIMIT = { max: 40, windowMinutes: 10 };

function translateChatError(message: string): string {
  if (/row-level security|permission denied/i.test(message)) {
    return "אין לך גישה לצ׳אט הזה";
  }
  return message;
}

export async function sendTradeMessageAction(
  _prevState: ChatActionState,
  formData: FormData
): Promise<ChatActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר מחדש" };

  const tradeRequestId = String(formData.get("tradeRequestId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!tradeRequestId) return { error: "טרייד לא תקין" };
  if (!body) return { error: "לא ניתן לשלוח הודעה ריקה" };
  if (body.length > 2000) return { error: "ההודעה ארוכה מדי (מקסימום 2000 תווים)" };

  const { data: myProfile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if ((myProfile as Profile | null)?.status === "suspended") {
    return { error: "החשבון שלך מושהה ולא ניתן לשלוח הודעות כרגע." };
  }

  const { count: recentCount } = await supabase
    .from("trade_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", new Date(Date.now() - CHAT_MESSAGE_LIMIT.windowMinutes * 60 * 1000).toISOString());

  if ((recentCount ?? 0) >= CHAT_MESSAGE_LIMIT.max) {
    return {
      error: `שלחת יותר מדי הודעות. נסו שוב בעוד ${formatRetrySeconds(CHAT_MESSAGE_LIMIT.windowMinutes * 60)}.`,
    };
  }

  const { error } = await supabase
    .from("trade_messages")
    .insert({ trade_request_id: tradeRequestId, sender_id: user.id, body });

  if (error) return { error: translateChatError(error.message) };

  revalidatePath(`/dashboard/trades/${tradeRequestId}`);
  return {};
}

export async function markTradeMessagesReadAction(tradeRequestId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_trade_messages_read", { p_trade_request_id: tradeRequestId });
  revalidatePath(`/dashboard/trades/${tradeRequestId}`);
  revalidatePath("/dashboard/trades");
}
