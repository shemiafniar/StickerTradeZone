"use client";

import { useActionState } from "react";
import { updateUserAction, type UpdateUserState } from "@/lib/actions/admin";
import { FieldGroup, Input, Label, Select } from "@/components/ui/Field";
import { CityAutocomplete } from "@/components/ui/CityAutocomplete";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import type { AdminUserRow } from "@/lib/data/admin";

const initialState: UpdateUserState = {};

export function EditUserForm({ user }: { user: AdminUserRow }) {
  const [state, formAction] = useActionState(updateUserAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={user.id} />
      <ErrorMessage message={state.error} />
      {state.success && <SuccessMessage message="פרטי המשתמש עודכנו בהצלחה!" />}

      <FieldGroup>
        <Label htmlFor="fullName">שם מלא</Label>
        <Input id="fullName" name="fullName" required defaultValue={user.full_name} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="city">עיר</Label>
        <CityAutocomplete id="city" name="city" required defaultValue={user.city} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="neighborhood">שכונה (אופציונלי)</Label>
        <Input id="neighborhood" name="neighborhood" defaultValue={user.neighborhood ?? ""} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="role">תפקיד</Label>
        <Select id="role" name="role" defaultValue={user.role}>
          <option value="user">משתמש רגיל</option>
          <option value="admin">מנהל</option>
        </Select>
      </FieldGroup>

      <SubmitButton>שמירת שינויים</SubmitButton>
    </form>
  );
}
