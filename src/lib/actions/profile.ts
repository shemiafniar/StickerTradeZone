"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ISRAEL_CITIES } from "@/lib/cities";

export interface ProfileActionState {
  error?: string;
  success?: boolean;
}

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר מחדש" };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "");

  if (!fullName || !city || !phone) {
    return { error: "נא למלא שם, עיר וטלפון" };
  }

  if (!ISRAEL_CITIES.includes(city)) {
    return { error: "נא לבחור עיר מהרשימה" };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, city, neighborhood: neighborhood || null })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  const { error: contactError } = await supabase
    .from("profile_contacts")
    .upsert({ user_id: user.id, phone, whatsapp: phone });

  if (contactError) return { error: contactError.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { success: true };
}
