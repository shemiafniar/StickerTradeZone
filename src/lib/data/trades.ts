import { createClient } from "@/lib/supabase/server";
import { getStickerIdToCodeMap } from "@/lib/data/stickers";
import type { Profile, TradeRequest, TradeRequestItem } from "@/types/database";

export interface TradeRequestWithDetails extends TradeRequest {
  otherUser: Profile | null;
  isSender: boolean;
  itemsToGive: { stickerCode: string; quantity: number }[];
  itemsToReceive: { stickerCode: string; quantity: number }[];
}

export async function getTradeRequestsForCurrentUser(): Promise<TradeRequestWithDetails[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: trades } = await supabase
    .from("trade_requests")
    .select("*")
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const tradeRows = (trades as TradeRequest[]) ?? [];
  if (tradeRows.length === 0) return [];

  const tradeIds = tradeRows.map((t) => t.id);
  const otherUserIds = Array.from(
    new Set(tradeRows.map((t) => (t.from_user_id === user.id ? t.to_user_id : t.from_user_id)))
  );

  const [{ data: items }, { data: profiles }, idToCode] = await Promise.all([
    supabase.from("trade_request_items").select("*").in("trade_request_id", tradeIds),
    supabase.from("profiles").select("*").in("id", otherUserIds),
    getStickerIdToCodeMap(),
  ]);

  const profileMap = new Map((profiles as Profile[] | null)?.map((p) => [p.id, p]) ?? []);
  const itemsByTrade = new Map<string, TradeRequestItem[]>();
  for (const item of (items as TradeRequestItem[]) ?? []) {
    if (!itemsByTrade.has(item.trade_request_id)) itemsByTrade.set(item.trade_request_id, []);
    itemsByTrade.get(item.trade_request_id)!.push(item);
  }

  return tradeRows.map((trade) => {
    const isSender = trade.from_user_id === user.id;
    const otherUserId = isSender ? trade.to_user_id : trade.from_user_id;
    const tradeItems = itemsByTrade.get(trade.id) ?? [];

    // direction is stored from the sender's (from_user) perspective:
    // 'give' = from_user gives it, 'receive' = from_user receives it.
    const giveDirection = isSender ? "give" : "receive";
    const receiveDirection = isSender ? "receive" : "give";

    return {
      ...trade,
      otherUser: profileMap.get(otherUserId) ?? null,
      isSender,
      itemsToGive: tradeItems
        .filter((i) => i.direction === giveDirection)
        .map((i) => ({ stickerCode: idToCode.get(i.sticker_id) ?? "", quantity: i.quantity })),
      itemsToReceive: tradeItems
        .filter((i) => i.direction === receiveDirection)
        .map((i) => ({ stickerCode: idToCode.get(i.sticker_id) ?? "", quantity: i.quantity })),
    };
  });
}

export async function getTradeRequestById(tradeId: string): Promise<TradeRequestWithDetails | null> {
  const all = await getTradeRequestsForCurrentUser();
  return all.find((t) => t.id === tradeId) ?? null;
}
