"use client";

import { useEffect, useState, useTransition } from "react";
import { saveTeamGridAction } from "@/lib/actions/stickers";
import { ColorLegend } from "@/components/collection/ColorLegend";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { StickerCell } from "@/lib/data/collection";

type CellStatus = "none" | "have" | "duplicate" | "missing";

const CYCLE: CellStatus[] = ["none", "have", "duplicate", "missing"];

const STATUS_STYLES: Record<CellStatus, string> = {
  none: "bg-black/[0.04] text-foreground/30 border-black/10",
  have: "bg-green-500 text-white border-green-600 shadow-sm",
  duplicate: "bg-blue-500 text-white border-blue-600 shadow-sm",
  missing: "bg-red-500 text-white border-red-600 shadow-sm",
};

interface Cell {
  id: string;
  code: string;
  number: number;
  status: CellStatus;
}

export function StickerGrid({ teamCode, initialCells }: { teamCode: string; initialCells: StickerCell[] }) {
  const [cells, setCells] = useState<Cell[]>(() =>
    initialCells.map((c) => ({ id: c.id, code: c.code, number: c.number, status: c.status }))
  );
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<{ error?: string; success?: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function cycle(index: number) {
    setCells((prev) => {
      const next = [...prev];
      const currentIdx = CYCLE.indexOf(next[index].status);
      next[index] = { ...next[index], status: CYCLE[(currentIdx + 1) % CYCLE.length] };
      return next;
    });
    setDirty(true);
    setSaveState(null);
  }

  function markAllOwned() {
    setCells((prev) => prev.map((c) => ({ ...c, status: "have" as CellStatus })));
    setDirty(true);
    setSaveState(null);
  }

  function clearAll() {
    setCells((prev) => prev.map((c) => ({ ...c, status: "none" as CellStatus })));
    setDirty(true);
    setSaveState(null);
  }

  function save() {
    startSaving(async () => {
      const result = await saveTeamGridAction(
        teamCode,
        cells.map((c) => ({ stickerId: c.id, status: c.status }))
      );
      if (result.error) {
        setSaveState({ error: result.error });
      } else {
        setSaveState({ success: "האוסף נשמר בהצלחה! 🎉" });
        setDirty(false);
      }
    });
  }

  const counts = cells.reduce(
    (acc, c) => {
      if (c.status !== "none") acc[c.status] += 1;
      return acc;
    },
    { have: 0, duplicate: 0, missing: 0 }
  );

  return (
    <div>
      <ColorLegend className="mb-4" />

      <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
        {cells.map((cell, i) => (
          <button
            key={cell.code}
            type="button"
            onClick={() => cycle(i)}
            aria-label={`${cell.code}: ${cell.status}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-xl border-2 text-base font-extrabold transition-all duration-150 active:scale-90",
              STATUS_STYLES[cell.status]
            )}
          >
            {cell.number}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-foreground/50">
        {counts.have} ברשותי · {counts.duplicate} כפולות · {counts.missing} חסרות
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
