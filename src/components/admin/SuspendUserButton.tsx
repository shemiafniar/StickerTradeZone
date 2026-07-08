"use client";

import { useActionState } from "react";
import { setUserSuspendedAction, type SuspendUserState } from "@/lib/actions/admin";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage } from "@/components/ui/FormMessage";

const initialState: SuspendUserState = {};

export function SuspendUserButton({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, formAction] = useActionState(setUserSuspendedAction, initialState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="suspend" value={String(!suspended)} />
        <SubmitButton variant={suspended ? "outline" : "danger"} size="sm">
          {suspended ? "ביטול השעיה" : "השעיית משתמש"}
        </SubmitButton>
      </form>
      <ErrorMessage message={state.error} />
    </div>
  );
}
