"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface NotificationActionState {
  error?: string;
  success?: boolean;
}

/**
 * Marks a single notification as read for the current user.
 *
 * Server-side authorization: `mark_notification_read()` is a SECURITY
 * DEFINER function that filters by `user_id = auth.uid()` internally (see
 * 0005_notifications.sql), so this can only ever affect the caller's own
 * notifications regardless of what id is passed in - there is no separate
 * "is this notification mine?" check needed here, the RPC already
 * guarantees it.
 */
export async function markNotificationReadAction(notificationId: string): Promise<NotificationActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "יש להתחבר מחדש כדי לבצע פעולה זו" };

    const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: notificationId });
    if (error) {
      console.error("[markNotificationReadAction] RPC failed:", error.message);
      return { error: "לא ניתן היה לסמן את ההתראה כנקראה. נסו שוב." };
    }

    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (err) {
    console.error("[markNotificationReadAction] Unexpected error:", err);
    return { error: "אירעה שגיאה בלתי צפויה. נסו שוב." };
  }
}

/**
 * Marks every one of the current user's unread notifications as read.
 *
 * Server-side authorization: `mark_all_notifications_read()` is a SECURITY
 * DEFINER function scoped to `user_id = auth.uid()` (see
 * 0005_notifications.sql) - it can never touch another user's rows, and
 * this action independently confirms there's an authenticated user before
 * even attempting the call.
 */
export async function markAllNotificationsReadAction(): Promise<NotificationActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "יש להתחבר מחדש כדי לבצע פעולה זו" };

    const { error } = await supabase.rpc("mark_all_notifications_read");
    if (error) {
      console.error("[markAllNotificationsReadAction] RPC failed:", error.message);
      return { error: "לא ניתן היה לסמן את ההתראות כנקראו. נסו שוב." };
    }

    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (err) {
    console.error("[markAllNotificationsReadAction] Unexpected error:", err);
    return { error: "אירעה שגיאה בלתי צפויה. נסו שוב." };
  }
}
