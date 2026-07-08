"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import type { StickerActionState } from "@/lib/actions/stickers";

const initialState: StickerActionState = {};

export function BulkStickerForm({
  action,
  showForSale,
  placeholder,
}: {
  action: (state: StickerActionState, formData: FormData) => Promise<StickerActionState>;
  showForSale?: boolean;
  placeholder: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mb-6">
      <ErrorMessage message={state.error} />
      {state.success && <SuccessMessage message={`נוספו ${state.addedCount} מדבקות בהצלחה!`} />}

      <Textarea name="numbers" required placeholder={placeholder} dir="ltr" className="text-right" />
      <p className="mt-1.5 text-xs text-foreground/50">
        ניתן להזין מספרים בודדים (1,2,3), טווחים (1-20) או שילוב של שניהם, מופרדים בפסיקים.
      </p>

      {showForSale && (
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground/70">
          <input type="checkbox" name="forSale" className="h-4 w-4 rounded accent-brand" />
          זמין גם למכירה (לא רק להחלפה)
        </label>
      )}

      <SubmitButton className="mt-3 w-full sm:w-auto">הוספה מהירה</SubmitButton>
    </form>
  );
}
