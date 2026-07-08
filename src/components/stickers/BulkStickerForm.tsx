"use client";

import { useActionState } from "react";
import { Textarea, Select, Label } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import type { StickerActionState } from "@/lib/actions/stickers";

const initialState: StickerActionState = {};

export function BulkStickerForm({
  action,
  showListingType,
  placeholder,
}: {
  action: (state: StickerActionState, formData: FormData) => Promise<StickerActionState>;
  showListingType?: boolean;
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

      {showListingType && (
        <div className="mt-3 max-w-xs">
          <Label htmlFor="listingType">איך להציג את המדבקות האלו?</Label>
          <Select id="listingType" name="listingType" defaultValue="trade">
            <option value="trade">להחלפה בלבד</option>
            <option value="sale">למכירה בלבד</option>
            <option value="both">להחלפה או למכירה</option>
          </Select>
          <p className="mt-1 text-xs text-foreground/50">
            אפשר לשנות מחיר והערה לכל מדבקה בנפרד ברשימה למטה.
          </p>
        </div>
      )}

      <SubmitButton className="mt-3 w-full sm:w-auto">הוספה מהירה</SubmitButton>
    </form>
  );
}
