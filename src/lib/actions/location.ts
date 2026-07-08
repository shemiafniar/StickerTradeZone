"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface LocationActionState {
  error?: string;
  success?: boolean;
}

export async function updateLocationAction(formData: FormData): Promise<LocationActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר מחדש" };

  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: "מיקום לא תקין" };
  }

  // Round again server-side, defense in depth on top of the client-side rounding.
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;

  const { error: locError } = await supabase
    .from("profile_locations")
    .upsert({ user_id: user.id, latitude: roundedLat, longitude: roundedLng });
  if (locError) return { error: locError.message };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ location_enabled: true })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  revalidatePath("/dashboard/matches");
  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function disableLocationAction(): Promise<LocationActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר מחדש" };

  const { error } = await supabase.rpc("disable_my_location");
  if (error) return { error: error.message };

  revalidatePath("/dashboard/matches");
  revalidatePath("/dashboard/profile");
  return { success: true };
}
