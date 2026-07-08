"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ChatActionState {
  error?: string;
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
  if (body.length > 2000) return { error: "ההודעה ארוכה מדי" };

  const { error } = await supabase
    .from("trade_messages")
    .insert({ trade_request_id: tradeRequestId, sender_id: user.id, body });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/trades/${tradeRequestId}`);
  return {};
}

export async function markTradeMessagesReadAction(tradeRequestId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_trade_messages_read", { p_trade_request_id: tradeRequestId });
  revalidatePath(`/dashboard/trades/${tradeRequestId}`);
  revalidatePath("/dashboard/trades");
}
