"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

/**
 * Prominent, always-live-data-driven progress checklist on the dashboard -
 * requirement #6's "dashboard progress guidance". Hides itself entirely
 * once every step is complete (never shown again to a returning power
 * user), and can be dismissed for the current visit without losing
 * progress - reappears on the next page load if steps are still
 * incomplete, which is the point: it's a *reminder*, not a one-time modal.
 */
export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const [dismissed, setDismissed] = useState(false);
  const allDone = items.every((i) => i.done);

  if (allDone || dismissed) return null;

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="mb-6 rounded-2xl border border-brand/20 bg-brand/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-extrabold text-brand-dark">🚀 השלימו את ההגדרה הראשונית</p>
          <p className="text-xs text-foreground/60">
            {doneCount}/{items.length} שלבים הושלמו - כך תגיעו להתאמות וטריידים מהר יותר
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="הסתרת הכרטיס"
          className="rounded-lg px-2 py-1 text-sm text-foreground/40 hover:bg-black/5 hover:text-foreground/60"
        >
          ✕
        </button>
      </div>

      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
        />
      </div>

      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white/60",
                item.done ? "text-foreground/50" : "font-bold text-foreground"
              )}
            >
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs", item.done ? "bg-green-500 text-white" : "border-2 border-black/20")}>
                {item.done ? "✓" : ""}
              </span>
              <span className={cn(item.done && "line-through")}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
