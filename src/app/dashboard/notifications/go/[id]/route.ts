import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveNotificationTarget } from "@/lib/notifications/resolveTarget";
import type { Notification } from "@/types/database";

/**
 * Server-validated redirect for a notification click - the single place
 * that decides where `/dashboard/notifications/go/{id}` actually sends the
 * user, instead of trusting the (possibly stale) `link` string that was
 * true when the notification was created. Always ends in a redirect, never
 * renders a 404: an invalid, deleted, or no-longer-accessible target falls
 * back to `/dashboard/notifications?unavailable=1`, which shows a clear
 * "this is no longer available" notice instead of Next.js's generic
 * not-found page.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fallback = new URL("/dashboard/notifications?unavailable=1", request.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // RLS (`notifications_select_self`) already scopes this to the caller's
  // own notifications (or an admin's broader visibility) - the explicit
  // `user_id === user.id` check below is defense in depth so an admin's
  // own click can never be redirected into a notification (and therefore a
  // trade) that isn't actually theirs, even though they're technically
  // allowed to read the row.
  const { data: notification } = await supabase.from("notifications").select("*").eq("id", id).maybeSingle();
  if (!notification || (notification as Notification).user_id !== user.id) {
    return NextResponse.redirect(fallback);
  }

  // Best-effort, idempotent (mark_notification_read only touches unread
  // rows) - a failure here must never prevent the redirect itself.
  const { error: markReadError } = await supabase.rpc("mark_notification_read", { p_notification_id: id });
  if (markReadError) {
    console.error("[notifications/go] Failed to mark notification as read:", markReadError.message);
  }

  const target = await resolveNotificationTarget(supabase, notification as Notification, user.id);
  if (!target) return NextResponse.redirect(fallback);

  return NextResponse.redirect(new URL(target, request.url));
}
