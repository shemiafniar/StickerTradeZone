import { describe, expect, it } from "vitest";
import { filterTrades } from "@/lib/tradeFilters";
import type { TradeRequestWithDetails } from "@/lib/data/trades";
import type { TradeStatus } from "@/types/database";

function makeTrade(overrides: Partial<TradeRequestWithDetails> & { status: TradeStatus }): TradeRequestWithDetails {
  return {
    id: `trade-${Math.random()}`,
    from_user_id: "me",
    to_user_id: "other",
    message: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    otherUser: null,
    isSender: true,
    itemsToGive: [],
    itemsToReceive: [],
    ...overrides,
  };
}

const PENDING_SENT = makeTrade({ id: "pending-sent", status: "pending", isSender: true });
const PENDING_RECEIVED = makeTrade({ id: "pending-received", status: "pending", isSender: false });
const ACCEPTED_SENT = makeTrade({ id: "accepted-sent", status: "accepted", isSender: true });
const ACCEPTED_RECEIVED = makeTrade({ id: "accepted-received", status: "accepted", isSender: false });
const COMPLETED_SENT = makeTrade({ id: "completed-sent", status: "completed", isSender: true });
const DECLINED_RECEIVED = makeTrade({ id: "declined-received", status: "declined", isSender: false });
const CANCELLED_SENT = makeTrade({ id: "cancelled-sent", status: "cancelled", isSender: true });

const ALL_TRADES: TradeRequestWithDetails[] = [
  PENDING_SENT,
  PENDING_RECEIVED,
  ACCEPTED_SENT,
  ACCEPTED_RECEIVED,
  COMPLETED_SENT,
  DECLINED_RECEIVED,
  CANCELLED_SENT,
];

describe("filterTrades - status groupings", () => {
  it("'all' status + 'all' direction returns the complete list, unchanged order", () => {
    const result = filterTrades(ALL_TRADES, "all", "all");
    expect(result).toEqual(ALL_TRADES);
  });

  it("'pending' returns only pending trades regardless of direction", () => {
    const result = filterTrades(ALL_TRADES, "pending", "all");
    expect(result.map((t) => t.id).sort()).toEqual(["pending-received", "pending-sent"]);
  });

  it("'active' returns only accepted trades", () => {
    const result = filterTrades(ALL_TRADES, "active", "all");
    expect(result.map((t) => t.id).sort()).toEqual(["accepted-received", "accepted-sent"]);
  });

  it("'completed' returns only completed trades", () => {
    const result = filterTrades(ALL_TRADES, "completed", "all");
    expect(result.map((t) => t.id)).toEqual(["completed-sent"]);
  });

  it("'declined_cancelled' groups both declined and cancelled trades together", () => {
    const result = filterTrades(ALL_TRADES, "declined_cancelled", "all");
    expect(result.map((t) => t.id).sort()).toEqual(["cancelled-sent", "declined-received"]);
  });
});

describe("filterTrades - direction", () => {
  it("'sent' returns only trades the current user initiated", () => {
    const result = filterTrades(ALL_TRADES, "all", "sent");
    expect(result.every((t) => t.isSender)).toBe(true);
    expect(result).toHaveLength(4);
  });

  it("'received' returns only trades the current user received", () => {
    const result = filterTrades(ALL_TRADES, "all", "received");
    expect(result.every((t) => !t.isSender)).toBe(true);
    expect(result).toHaveLength(3);
  });
});

describe("filterTrades - combined status and direction filters", () => {
  it("'pending' + 'sent' narrows to exactly the matching trade", () => {
    const result = filterTrades(ALL_TRADES, "pending", "sent");
    expect(result.map((t) => t.id)).toEqual(["pending-sent"]);
  });

  it("'declined_cancelled' + 'received' narrows to only the declined one (cancelled was sent)", () => {
    const result = filterTrades(ALL_TRADES, "declined_cancelled", "received");
    expect(result.map((t) => t.id)).toEqual(["declined-received"]);
  });

  it("'completed' + 'received' returns an empty list (the only completed trade was sent)", () => {
    const result = filterTrades(ALL_TRADES, "completed", "received");
    expect(result).toEqual([]);
  });
});

describe("filterTrades - empty result / restore behavior", () => {
  it("returns an empty array when no trade matches the selected filter", () => {
    const onlyPending = [PENDING_SENT];
    expect(filterTrades(onlyPending, "completed", "all")).toEqual([]);
  });

  it("'all' + 'all' always restores the complete, original list even after narrowing filters were used", () => {
    filterTrades(ALL_TRADES, "pending", "sent");
    const restored = filterTrades(ALL_TRADES, "all", "all");
    expect(restored).toEqual(ALL_TRADES);
    expect(restored).toHaveLength(ALL_TRADES.length);
  });

  it("never mutates the input array", () => {
    const copy = [...ALL_TRADES];
    filterTrades(ALL_TRADES, "pending", "sent");
    expect(ALL_TRADES).toEqual(copy);
  });
});
