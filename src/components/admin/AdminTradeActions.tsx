"use client";

import { useActionState } from "react";
import {
  adminCancelTradeAction,
  adminDeleteTradeAction,
  adminForceCompleteTradeAction,
  type AdminTradeActionState,
} from "@/lib/actions/admin";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage } from "@/components/ui/FormMessage";

const initialState: AdminTradeActionState = {};

function ActionForm({
  tradeId,
  action,
  label,
  variant,
  confirmMessage,
}: {
  tradeId: string;
  action: (state: AdminTradeActionState, formData: FormData) => Promise<AdminTradeActionState>;
  label: string;
  variant: "outline" | "danger";
  confirmMessage?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
        }}
      >
        <input type="hidden" name="tradeId" value={tradeId} />
        <SubmitButton variant={variant} size="sm">
          {label}
        </SubmitButton>
      </form>
      <ErrorMessage message={state.error} />
    </div>
  );
}

export function AdminTradeActions({ tradeId, status }: { tradeId: string; status: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status !== "cancelled" && status !== "completed" && (
        <ActionForm tradeId={tradeId} action={adminCancelTradeAction} label="ביטול טרייד" variant="outline" />
      )}
      {status !== "completed" && (
        <ActionForm
          tradeId={tradeId}
          action={adminForceCompleteTradeAction}
          label="השלמה בכפייה"
          variant="outline"
        />
      )}
      <ActionForm
        tradeId={tradeId}
        action={adminDeleteTradeAction}
        label="מחיקה"
        variant="danger"
        confirmMessage="למחוק לצמיתות את בקשת הטרייד הזו? כל ההודעות בצ'אט שלה יימחקו גם כן."
      />
    </div>
  );
}
