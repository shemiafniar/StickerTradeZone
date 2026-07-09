"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteUserAction, type DeleteUserState } from "@/lib/actions/admin";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage } from "@/components/ui/FormMessage";

const initialState: DeleteUserState = {};

export function DeleteUserButton({ userId, fullName }: { userId: string; fullName: string }) {
  const [state, formAction] = useActionState(deleteUserAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.replace("/admin/users");
    }
  }, [state.success, router]);

  return (
    <div>
      <form
        action={formAction}
        onSubmit={(e) => {
          const confirmed = window.confirm(
            `למחוק לצמיתות את המשתמש/ת "${fullName || "משתמש"}"? הפעולה תמחק את כל הנתונים שלו/ה (אוסף, טריידים, הודעות) ואינה הפיכה.`
          );
          if (!confirmed) e.preventDefault();
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <SubmitButton variant="danger" size="sm">
          מחיקת משתמש לצמיתות
        </SubmitButton>
      </form>
      <ErrorMessage message={state.error} />
    </div>
  );
}
