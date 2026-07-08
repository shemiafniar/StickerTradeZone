"use client";

import { useActionState } from "react";
import { addTeamAction, type UpdateCatalogState } from "@/lib/actions/admin";
import { FieldGroup, Input, Label } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";

const initialState: UpdateCatalogState = {};

export function AddTeamForm() {
  const [state, formAction] = useActionState(addTeamAction, initialState);

  return (
    <form action={formAction}>
      <ErrorMessage message={state.error} />
      {state.success && <SuccessMessage message="הנבחרת נוספה בהצלחה, עם 20 מדבקות חדשות!" />}

      <FieldGroup>
        <Label htmlFor="code">קוד נבחרת (3 אותיות)</Label>
        <Input id="code" name="code" maxLength={3} required placeholder="GER" dir="ltr" className="text-right uppercase" />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="nameHe">שם הנבחרת בעברית</Label>
        <Input id="nameHe" name="nameHe" required placeholder="גרמניה" />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="flagEmoji">דגל (אימוג&apos;י, אופציונלי)</Label>
        <Input id="flagEmoji" name="flagEmoji" placeholder="🇩🇪" dir="ltr" className="text-right" />
      </FieldGroup>

      <p className="mb-3 text-xs text-foreground/50">
        המערכת תיצור אוטומטית 20 מדבקות חדשות עבור הנבחרת (קוד-1 עד קוד-20).
      </p>

      <SubmitButton>הוספת נבחרת</SubmitButton>
    </form>
  );
}
