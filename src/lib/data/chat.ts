import { createClient } from "@/lib/supabase/server";
import type { TradeMessage } from "@/types/database";

export async function getTradeMessages(tradeRequestId: string): Promise<TradeMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trade_messages")
    .select("*")
    .eq("trade_request_id", tradeRequestId)
    .order("created_at", { ascending: true });

  return (data as TradeMessage[]) ?? [];
}

export async function getUnreadMessageCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map();

  const { data } = await supabase
    .from("trade_messages")
    .select("trade_request_id")
    .is("read_at", null)
    .neq("sender_id", user.id);

  const counts = new Map<string, number>();
  for (const row of (data as { trade_request_id: string }[] | null) ?? []) {
    counts.set(row.trade_request_id, (counts.get(row.trade_request_id) ?? 0) + 1);
  }
  return counts;
}
