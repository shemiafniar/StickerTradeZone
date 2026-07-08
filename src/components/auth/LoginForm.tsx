"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionState } from "@/lib/actions/auth";
import { FieldGroup, Input, Label } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage } from "@/components/ui/FormMessage";

const initialState: AuthActionState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="w-full">
      <ErrorMessage message={state.error} />
      <input type="hidden" name="next" value={next ?? "/dashboard"} />

      <FieldGroup>
        <Label htmlFor="email">אימייל</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="password">סיסמה</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </FieldGroup>

      <SubmitButton className="mt-2 w-full" size="lg">
        התחברות
      </SubmitButton>

      <p className="mt-5 text-center text-sm text-foreground/60">
        עדיין אין לכם חשבון?{" "}
        <Link href="/register" className="font-bold text-brand-dark">
          הרשמה
        </Link>
      </p>
    </form>
  );
}
