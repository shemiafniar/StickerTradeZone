/**
 * Canonical, single-source-of-truth rules for turning a raw
 * `user_stickers.quantity` value (or a collection of them) into the
 * concepts every part of the app actually cares about - owned/missing/
 * duplicate-available, and the aggregate counts derived from those.
 *
 * Every consumer (collection pages, matching, trade validation, admin
 * stats, the admin per-user collection detail page) MUST go through these
 * functions rather than re-deriving the same logic ad hoc - that's what
 * requirement #4 ("fix synchronization between collector data and admin
 * statistics") actually means in code: one set of rules, applied
 * everywhere, so the numbers can never drift apart again.
 *
 * Quantity semantics (see migration 0017_quantity_and_groups.sql):
 * - no row at all         -> "unmarked" (gray in the grid UI) - handled by
 *   callers themselves (there's no `quantity` to call these with), not by
 *   this module.
 * - row exists, quantity 0   -> missing (explicit "I need this" mark)
 * - row exists, quantity 1   -> owned, no duplicate available
 * - row exists, quantity N≥2 -> owned, with (N - 1) duplicates available
 */

/** True once a sticker has at least one copy - i.e. quantity >= 1. */
export function isOwned(quantity: number): boolean {
  return quantity >= 1;
}

/** True only for an explicit "missing" mark (a row with quantity exactly 0) - never true for "no row at all". */
export function isMissing(quantity: number): boolean {
  return quantity === 0;
}

/** How many spare copies are available to trade/sell - always >= 0, and always one less than the owned total (the collector's own copy is never counted as spare). */
export function availableDuplicates(quantity: number): number {
  return Math.max(0, quantity - 1);
}

/** True once there's at least one spare copy available (quantity >= 2). */
export function hasDuplicateAvailable(quantity: number): boolean {
  return availableDuplicates(quantity) > 0;
}

export interface CollectionCounts {
  /** Unique sticker codes with quantity >= 1. */
  ownedUnique: number;
  /** Unique sticker codes with an explicit quantity = 0 row (not "unmarked" - see module doc comment). */
  missingUnique: number;
  /** Unique sticker codes with at least one available duplicate (quantity >= 2). */
  duplicateUnique: number;
  /** Sum of availableDuplicates() across every row - the total number of spare copies across the whole collection. */
  totalDuplicateCopies: number;
}

const EMPTY_COUNTS: CollectionCounts = { ownedUnique: 0, missingUnique: 0, duplicateUnique: 0, totalDuplicateCopies: 0 };

/**
 * Canonical aggregate over a list of `user_stickers.quantity` values (one
 * per existing row - never include "unmarked"/no-row stickers here, those
 * aren't rows at all). Used identically by the user-facing collection data
 * layer, matching, and admin statistics, so all three can never disagree.
 */
export function summarizeQuantities(quantities: number[]): CollectionCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const quantity of quantities) {
    if (isOwned(quantity)) counts.ownedUnique += 1;
    else counts.missingUnique += 1;

    const duplicates = availableDuplicates(quantity);
    if (duplicates > 0) {
      counts.duplicateUnique += 1;
      counts.totalDuplicateCopies += duplicates;
    }
  }
  return counts;
}

/** A sticker cell's UI state, derived from its quantity (or absence of a row) - used by the grid, legend, and admin collection views. */
export type StickerCellState = "none" | "missing" | "owned" | "owned_with_duplicates";

export function getStickerCellState(quantity: number | null): StickerCellState {
  if (quantity === null) return "none";
  if (quantity === 0) return "missing";
  if (quantity === 1) return "owned";
  return "owned_with_duplicates";
}
