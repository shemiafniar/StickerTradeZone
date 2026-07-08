"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileActionState } from "@/lib/actions/profile";
import { FieldGroup, Input, Label, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorMessage, SuccessMessage } from "@/components/ui/FormMessage";
import { ISRAEL_CITIES } from "@/lib/cities";
import type { Profile, ProfileContact } from "@/types/database";

const initialState: ProfileActionState = {};

export function ProfileForm({ profile, contact }: { profile: Profile; contact: ProfileContact | null }) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction}>
      <ErrorMessage message={state.error} />
      {state.success && <SuccessMessage message="הפרופיל עודכן בהצלחה!" />}

      <FieldGroup>
        <Label htmlFor="fullName">שם מלא</Label>
        <Input id="fullName" name="fullName" required defaultValue={profile.full_name} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="city">עיר</Label>
        <Select id="city" name="city" required defaultValue={profile.city}>
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
        <Input id="neighborhood" name="neighborhood" defaultValue={profile.neighborhood ?? ""} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="phone">טלפון / וואטסאפ</Label>
        <Input id="phone" name="phone" type="tel" required defaultValue={contact?.phone ?? ""} dir="ltr" />
        <p className="mt-1.5 text-xs text-foreground/50">
          מספר הטלפון שלך יוצג לצד השני רק לאחר שתאשרו בקשת טרייד באופן הדדי.
        </p>
      </FieldGroup>

      <SubmitButton className="w-full sm:w-auto">שמירת שינויים</SubmitButton>
    </form>
  );
}
