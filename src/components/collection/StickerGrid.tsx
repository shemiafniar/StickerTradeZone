"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTeamGridAction } from "@/lib/actions/stickers";
import { getStickerCellState } from "@/lib/collectionStatus";
import { ColorLegend } from "@/components/collection/ColorLegend";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { StickerCell } from "@/lib/data/collection";

interface Cell {
  id: string;
  code: string;
  number: number;
  /** null = unmarked, 0 = missing, 1+ = owned (N-1 duplicates available). */
  quantity: number | null;
}

const STATE_STYLES = {
  none: "bg-black/[0.04] text-foreground/30 border-black/10",
  missing: "bg-red-500 text-white border-red-600 shadow-sm",
  owned: "bg-green-500 text-white border-green-600 shadow-sm",
  owned_with_duplicates: "bg-blue-500 text-white border-blue-600 shadow-sm",
} as const;

// Brief confirmation before navigating back to the team-selection page, so
// the save doesn't feel abrupt on mobile - long enough to read, short
// enough to not feel like a delay.
const REDIRECT_DELAY_MS = 900;

export function StickerGrid({ teamCode, initialCells }: { teamCode: string; initialCells: StickerCell[] }) {
  const [cells, setCells] = useState<Cell[]>(() =>
    initialCells.map((c) => ({ id: c.id, code: c.code, number: c.number, quantity: c.quantity }))
  );
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<{ error?: string; success?: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function updateCell(index: number, quantity: number | null) {
    setCells((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity };
      return next;
    });
    setDirty(true);
    setSaveState(null);
  }

  /** Tapping the cell body cycles: unmarked -> owned (1) -> missing (0) -> unmarked. */
  function cycle(index: number) {
    const current = cells[index].quantity;
    const next = current === null ? 1 : current === 0 ? null : 0;
    updateCell(index, next);
  }

  function incrementQuantity(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    const current = cells[index].quantity ?? 0;
    updateCell(index, current + 1);
  }

  function decrementQuantity(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    const current = cells[index].quantity ?? 0;
    updateCell(index, Math.max(0, current - 1));
  }

  function markAllOwned() {
    setCells((prev) => prev.map((c) => ({ ...c, quantity: Math.max(1, c.quantity ?? 1) })));
    setDirty(true);
    setSaveState(null);
  }

  function clearAll() {
    setCells((prev) => prev.map((c) => ({ ...c, quantity: null })));
    setDirty(true);
    setSaveState(null);
  }

  function save() {
    startSaving(async () => {
      const result = await saveTeamGridAction(
        teamCode,
        cells.map((c) => ({ stickerId: c.id, quantity: c.quantity }))
      );
      if (result.error) {
        // Never redirect on failure - the collector needs to see the error
        // and can retry from the same page.
        setSaveState({ error: result.error });
      } else {
        setSaveState({ success: "האוסף נשמר בהצלחה! 🎉 חוזרים לרשימת הנבחרות..." });
        setDirty(false);
        window.setTimeout(() => {
          router.push("/dashboard/stickers");
        }, REDIRECT_DELAY_MS);
      }
    });
  }

  const counts = cells.reduce(
    (acc, c) => {
      if (c.quantity === null) return acc;
      if (c.quantity === 0) acc.missing += 1;
      else {
        acc.owned += 1;
        acc.duplicateCopies += Math.max(0, c.quantity - 1);
      }
      return acc;
    },
    { owned: 0, duplicateCopies: 0, missing: 0 }
  );

  return (
    <div>
      <ColorLegend className="mb-4" />

      <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
        {cells.map((cell, i) => {
          const state = getStickerCellState(cell.quantity);
          const duplicateCount = cell.quantity !== null ? Math.max(0, cell.quantity - 1) : 0;
          return (
            <div key={cell.code} className="relative">
              <button
                type="button"
                onClick={() => cycle(i)}
                aria-label={`${cell.code}: ${state}${duplicateCount > 0 ? `, ${duplicateCount} כפולות` : ""}`}
                className={cn(
                  "flex aspect-square w-full items-center justify-center rounded-xl border-2 text-base font-extrabold transition-all duration-150 active:scale-90",
                  STATE_STYLES[state]
                )}
              >
                {cell.number}
              </button>

              {duplicateCount > 0 && (
                <span
                  className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-accent px-1 text-[10px] font-extrabold text-white shadow"
                  title={`${duplicateCount} כפולות זמינות`}
                >
                  ×{duplicateCount}
                </span>
              )}

              {cell.quantity !== null && cell.quantity >= 1 && (
                <div className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-black/10 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={(e) => decrementQuantity(i, e)}
                    aria-label={`${cell.code}: הפחתת כמות`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-foreground/60 hover:bg-black/5"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={(e) => incrementQuantity(i, e)}
                    aria-label={`${cell.code}: הוספת כמות`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-brand-dark hover:bg-brand/10"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mb-4 text-xs text-foreground/50">
        {counts.owned} ברשותי · {counts.duplicateCopies} כפולות זמינות · {counts.missing} חסרות
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={markAllOwned}>
          ✅ סמן הכל כברשותי
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearAll}>
          🗑️ נקה הכל
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!dirty || isSaving} className="mr-auto">
          {isSaving ? "שומר..." : dirty ? "💾 שמירה" : "✓ נשמר"}
        </Button>
      </div>

      {dirty && !saveState && (
        <p className="mt-3 text-xs font-medium text-amber-700">יש שינויים שלא נשמרו - לחצו על &quot;שמירה&quot;.</p>
      )}
      <div className="mt-3">
        <ErrorMessage message={saveState?.error} />
        <SuccessMessage message={saveState?.success} />
      </div>
    </div>
  );
}
