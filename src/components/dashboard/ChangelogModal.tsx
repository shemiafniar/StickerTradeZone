"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissChangelogAction } from "@/lib/actions/changelog";
import { Button } from "@/components/ui/Button";
import type { ChangelogEntry } from "@/lib/changelog";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Shown on the dashboard when the user hasn't dismissed the modal for the
 * current changelog version yet (see shouldShowChangelogModal() in
 * changelog.ts). Dismissing only ever marks *this* version as seen - there
 * is no "never show updates again" flag, so the next real release
 * naturally reopens this for everyone again.
 */
export function ChangelogModal({ entry }: { entry: ChangelogEntry }) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    startTransition(async () => {
      await dismissChangelogAction();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="מה חדש במערכת"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">מה חדש · גרסה {entry.version}</p>
        <h2 className="mt-1 text-lg font-extrabold">{entry.title}</h2>
        <p className="mt-1 text-xs text-foreground/50">{formatDate(entry.date)}</p>

        <ul className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto text-sm text-foreground/80">
          {entry.items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-brand">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Link href="/dashboard/changelog" className="text-sm font-bold text-foreground/40 hover:text-foreground/60">
            כל העדכונים
          </Link>
          <Button type="button" size="sm" onClick={dismiss} disabled={isPending}>
            הבנתי ✓
          </Button>
        </div>
      </div>
    </div>
  );
}
