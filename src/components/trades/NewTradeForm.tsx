"use client";

import { useActionState } from "react";
import { createTradeRequestAction, type TradeActionState } from "@/lib/actions/trades";
import { FieldGroup, Input, Label, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage } from "@/components/ui/FormMessage";

const initialState: TradeActionState = {};

export function NewTradeForm({
  toUserId,
  defaultGive,
  defaultReceive,
}: {
  toUserId: string;
  defaultGive: string;
  defaultReceive: string;
}) {
  const [state, formAction] = useActionState(createTradeRequestAction, initialState);

  return (
    <form action={formAction}>
      <ErrorMessage message={state.error} />
      <input type="hidden" name="toUserId" value={toUserId} />

      <FieldGroup>
        <Label htmlFor="receive">מדבקות שתקבל/י ממנו/ה</Label>
        <Input id="receive" name="receive" defaultValue={defaultReceive} placeholder="1-5, 12" dir="ltr" className="text-right" />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="give">מדבקות שתיתן/י לו/ה</Label>
        <Input id="give" name="give" defaultValue={defaultGive} placeholder="8, 20-22" dir="ltr" className="text-right" />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="message">הודעה קצרה (אופציונלי)</Label>
        <Textarea id="message" name="message" placeholder="היי! רוצה להחליף מדבקות?" />
      </FieldGroup>

      <SubmitButton className="w-full" size="lg">
        שלח בקשת טרייד
      </SubmitButton>
    </form>
  );
}
