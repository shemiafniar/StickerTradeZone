"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage } from "@/components/ui/FormMessage";
import type { TradeActionState } from "@/lib/actions/trades";

const initialState: TradeActionState = {};

export function TradeActionForm({
  tradeId,
  action,
  label,
  variant = "primary",
  className,
}: {
  tradeId: string;
  action: (state: TradeActionState, formData: FormData) => Promise<TradeActionState>;
  label: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className={className}>
      <form action={formAction}>
        <input type="hidden" name="tradeId" value={tradeId} />
        <SubmitButton variant={variant} className="w-full">
          {label}
        </SubmitButton>
      </form>
      <ErrorMessage message={state.error} />
    </div>
  );
}
