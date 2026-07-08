"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notification_read", { p_notification_id: notificationId });
  revalidatePath("/dashboard/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/dashboard/notifications");
}
