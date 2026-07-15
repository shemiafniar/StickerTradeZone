"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TradeStatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  filterTrades,
  TRADE_DIRECTION_FILTER_LABELS,
  TRADE_STATUS_FILTER_LABELS,
  type TradeDirectionFilter,
  type TradeStatusFilter,
} from "@/lib/tradeFilters";
import type { TradeRequestWithDetails } from "@/lib/data/trades";

const STATUS_FILTERS: TradeStatusFilter[] = ["all", "pending", "active", "completed", "declined_cancelled"];
const DIRECTION_FILTERS: TradeDirectionFilter[] = ["all", "sent", "received"];

/**
 * Client-side filtering over the already-fetched full trade history - see
 * src/lib/tradeFilters.ts. The underlying data already includes every
 * status (pending/accepted/declined/cancelled/completed); this component
 * only adds filter controls on top of it, at the current data scale
 * (per-user trade counts), so no server round-trip is needed per filter
 * change.
 */
export function TradesList({
  trades,
  unreadCounts,
}: {
  trades: TradeRequestWithDetails[];
  unreadCounts: Record<string, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<TradeStatusFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<TradeDirectionFilter>("all");

  const filtered = useMemo(
    () => filterTrades(trades, statusFilter, directionFilter),
    [trades, statusFilter, directionFilter]
  );

  const isFiltering = statusFilter !== "all" || directionFilter !== "all";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="סינון לפי סטטוס">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition",
                statusFilter === filter
                  ? "bg-brand text-white shadow-sm"
                  : "bg-black/5 text-foreground/60 hover:bg-black/10"
              )}
            >
              {TRADE_STATUS_FILTER_LABELS[filter]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="סינון לפי כיוון">
          {DIRECTION_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setDirectionFilter(filter)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold transition",
                directionFilter === filter
                  ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                  : "border-black/10 text-foreground/50 hover:bg-black/[0.03]"
              )}
            >
              {TRADE_DIRECTION_FILTER_LABELS[filter]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground/60">
            {isFiltering
              ? "אין בקשות טרייד התואמות לסינון שנבחר. נסו לבחור סינון אחר."
              : "אין עדיין בקשות טרייד. עברו לעמוד ההתאמות כדי למצוא אספנים קרובים."}
          </p>
          {!isFiltering && (
            <Link href="/dashboard/matches" className="mt-2 inline-block text-sm font-bold text-brand-dark">
              לעמוד ההתאמות
            </Link>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((trade) => (
            <Link key={trade.id} href={`/dashboard/trades/${trade.id}`}>
              <Card interactive>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-extrabold">{trade.otherUser?.full_name ?? "אספן"}</p>
                    <p className="text-xs text-foreground/50">
                      {trade.isSender ? "בקשה שנשלחה" : "בקשה שהתקבלה"} ·{" "}
                      {new Date(trade.created_at).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(unreadCounts[trade.id] ?? 0) > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                        {unreadCounts[trade.id]}
                      </span>
                    )}
                    <TradeStatusBadge status={trade.status} />
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-foreground/60">
                  <span>מקבל: {trade.itemsToReceive.length} מדבקות</span>
                  <span>נותן: {trade.itemsToGive.length} מדבקות</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
