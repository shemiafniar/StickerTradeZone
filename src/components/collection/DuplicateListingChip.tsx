"use client";

import { useActionState, useState } from "react";
import {
  removeDuplicateListingAction,
  updateDuplicateListingAction,
  type UpdateListingState,
} from "@/lib/actions/stickers";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Select, Input, Textarea } from "@/components/ui/Field";
import { ErrorMessage } from "@/components/ui/FormMessage";
import type { DuplicateListing } from "@/lib/data/collection";

const listingLabels: Record<string, { label: string; className: string }> = {
  trade: { label: "להחלפה", className: "bg-blue-50 text-blue-700" },
  sale: { label: "למכירה", className: "bg-accent/20 text-orange-700" },
  both: { label: "החלפה/מכירה", className: "bg-accent/20 text-orange-700" },
};

const initialState: UpdateListingState = {};

export function DuplicateListingChip({ item }: { item: DuplicateListing }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateDuplicateListingAction, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  if (open) {
    return (
      <form action={formAction} className="w-full max-w-xs rounded-xl border border-brand/30 bg-brand/5 p-3">
        <input type="hidden" name="id" value={item.id} />
        <p className="mb-2 text-sm font-bold">עריכת מדבקה {item.code}</p>
        <ErrorMessage message={state.error} />

        <Select name="listingType" defaultValue={item.listing_type} className="mb-2">
          <option value="trade">להחלפה בלבד</option>
          <option value="sale">למכירה בלבד</option>
          <option value="both">להחלפה או למכירה</option>
        </Select>

        <Input
          name="price"
          type="number"
          min={0}
          step="0.5"
          placeholder="מחיר בשקלים (אופציונלי)"
          defaultValue={item.price ?? ""}
          className="mb-2"
        />

        <Textarea name="note" placeholder="הערה (אופציונלי)" defaultValue={item.note ?? ""} className="mb-2 min-h-16" />

        <div className="flex gap-2">
          <SubmitButton size="sm">שמירה</SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl px-3 py-1.5 text-sm font-bold text-foreground/60 hover:bg-black/5"
          >
            ביטול
          </button>
        </div>
      </form>
    );
  }

  const listing = listingLabels[item.listing_type] ?? listingLabels.trade;

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white py-1.5 pr-1.5 pl-3 text-sm font-bold shadow-sm">
      <span className="rounded-lg bg-brand/10 px-2 py-1 text-brand-dark">{item.code}</span>
      <span
        className="rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-bold text-orange-700"
        title="כפולות זמינות להחלפה/מכירה"
      >
        ×{item.availableDuplicates}
      </span>
      <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${listing.className}`}>{listing.label}</span>
      {item.price != null && <span className="text-xs font-bold text-orange-700">{item.price}₪</span>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-1.5 py-1 text-xs text-foreground/50 hover:bg-black/5"
        title="עריכה"
      >
        ✏️
      </button>
      <form action={removeDuplicateListingAction}>
        <input type="hidden" name="id" value={item.id} />
        <button type="submit" className="rounded-lg px-1.5 py-1 text-xs text-red-500 hover:bg-red-50" title="הסר">
          ✕
        </button>
      </form>
    </div>
  );
}
