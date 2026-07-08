"use client";

import { useActionState } from "react";
import { updateTotalStickersAction, importStickerListAction, type UpdateCatalogState } from "@/lib/actions/admin";
import { FieldGroup, Input, Label, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";

const initialState: UpdateCatalogState = {};

export function TotalStickersForm({ currentTotal }: { currentTotal: number }) {
  const [state, formAction] = useActionState(updateTotalStickersAction, initialState);

  return (
    <form action={formAction}>
      <ErrorMessage message={state.error} />
      {state.success && <SuccessMessage message="קטלוג המדבקות עודכן בהצלחה!" />}

      <FieldGroup>
        <Label htmlFor="total">מספר מדבקות כולל בסדרה</Label>
        <Input id="total" name="total" type="number" min={0} max={5000} required defaultValue={currentTotal} />
        <p className="mt-1.5 text-xs text-foreground/50">
          המערכת תיצור אוטומטית מדבקות ממוספרות 1 עד המספר שהוזן (מדבקות קיימות לא יימחקו).
        </p>
      </FieldGroup>

      <SubmitButton>עדכון כמות מדבקות</SubmitButton>
    </form>
  );
}

export function ImportStickerListForm() {
  const [state, formAction] = useActionState(importStickerListAction, initialState);

  return (
    <form action={formAction}>
      <ErrorMessage message={state.error} />
      {state.success && <SuccessMessage message="הרשימה יובאה בהצלחה!" />}

      <FieldGroup>
        <Label htmlFor="list">ייבוא רשימת מדבקות</Label>
        <Textarea
          id="list"
          name="list"
          placeholder={"פורמט: מספר,שם (אופציונלי),קבוצה (אופציונלי)\n1,שער ראשי\n2,שחקן לדוגמה,נבחרת לדוגמה"}
          dir="ltr"
          className="text-right"
          rows={6}
        />
        <p className="mt-1.5 text-xs text-foreground/50">
          שורה אחת לכל מדבקה. אפשר להזין רק מספרים ללא שמות - זה תקין ל-MVP.
        </p>
      </FieldGroup>

      <SubmitButton>ייבוא רשימה</SubmitButton>
    </form>
  );
}
