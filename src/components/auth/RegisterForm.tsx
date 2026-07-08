"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionState } from "@/lib/actions/auth";
import { FieldGroup, Input, Label, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { ISRAEL_CITIES } from "@/lib/cities";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction] = useActionState(signUpAction, initialState);

  return (
    <div className="w-full">
      <GoogleSignInButton />
      <OrDivider />

      <form action={formAction} className="w-full">
        <ErrorMessage message={state.error} />
        <SuccessMessage message={state.message} />

        <FieldGroup>
          <Label htmlFor="fullName">שם מלא</Label>
          <Input id="fullName" name="fullName" required placeholder="ישראל ישראלי" autoComplete="name" />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            dir="ltr"
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="לפחות 6 תווים"
            autoComplete="new-password"
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="city">עיר</Label>
          <Select id="city" name="city" required defaultValue="">
            <option value="" disabled>
              בחרו עיר
            </option>
            {ISRAEL_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="neighborhood">שכונה (אופציונלי)</Label>
          <Input id="neighborhood" name="neighborhood" placeholder="למשל: רמת אביב" />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="phone">טלפון / וואטסאפ</Label>
          <Input id="phone" name="phone" type="tel" required placeholder="050-1234567" dir="ltr" />
          <p className="mt-1.5 text-xs text-foreground/50">
            מספר הטלפון יוצג לצד השני רק לאחר שתאשרו בקשת טרייד.
          </p>
        </FieldGroup>

        <SubmitButton className="mt-2 w-full" size="lg">
          הרשמה
        </SubmitButton>

        <p className="mt-5 text-center text-sm text-foreground/60">
          כבר יש לכם חשבון?{" "}
          <Link href="/login" className="font-bold text-brand-dark">
            התחברות
          </Link>
        </p>
      </form>
    </div>
  );
}
