import type { TradeRequestWithDetails } from "@/lib/data/trades";

/**
 * The existing trade data already covers the full lifecycle - pending,
 * accepted, declined, cancelled, and completed - with no status filtering
 * at all (getTradeRequestsForCurrentUser() already fetches every trade
 * regardless of status). This module only groups those existing statuses
 * for the UI; it introduces no new status, no "expired" concept, and no
 * database changes.
 */
export type TradeStatusFilter = "all" | "pending" | "active" | "completed" | "declined_cancelled";
export type TradeDirectionFilter = "all" | "sent" | "received";

export const TRADE_STATUS_FILTER_LABELS: Record<TradeStatusFilter, string> = {
  all: "הכל",
  pending: "ממתינות",
  active: "פעילות",
  completed: "הושלמו",
  declined_cancelled: "נדחו/בוטלו",
};

export const TRADE_DIRECTION_FILTER_LABELS: Record<TradeDirectionFilter, string> = {
  all: "הכל",
  sent: "נשלחו על ידי",
  received: "התקבלו אצלי",
};

function matchesStatusFilter(trade: TradeRequestWithDetails, filter: TradeStatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "pending":
      return trade.status === "pending";
    case "active":
      return trade.status === "accepted";
    case "completed":
      return trade.status === "completed";
    case "declined_cancelled":
      return trade.status === "declined" || trade.status === "cancelled";
  }
}

function matchesDirectionFilter(trade: TradeRequestWithDetails, filter: TradeDirectionFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "sent":
      return trade.isSender;
    case "received":
      return !trade.isSender;
  }
}

/**
 * Pure filtering over the already-fetched full trade list - no new query,
 * no new database column. Preserves the existing sort order (the input
 * list is already newest-first from getTradeRequestsForCurrentUser(); this
 * never re-sorts).
 */
export function filterTrades(
  trades: TradeRequestWithDetails[],
  statusFilter: TradeStatusFilter,
  directionFilter: TradeDirectionFilter
): TradeRequestWithDetails[] {
  return trades.filter(
    (trade) => matchesStatusFilter(trade, statusFilter) && matchesDirectionFilter(trade, directionFilter)
  );
}
