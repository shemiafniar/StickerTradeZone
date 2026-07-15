import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Notification } from "@/types/database";

/**
 * The only notification link shape this app has ever generated (see
 * `notify_trade_request_events()`/`notify_new_trade_message()` in
 * `0005_notifications.sql`) - a trade detail page, which is also where
 * trade chat lives, so a chat notification correctly resolves here too.
 * Anything else (a different path, an absolute URL, a protocol-relative
 * `//host` link, `javascript:`, etc.) is treated as unsupported/unsafe and
 * falls back to the notifications page - this is a whitelist, not a
 * blocklist, specifically so a future notification type with an
 * unanticipated link shape fails safe by default instead of open-redirecting.
 */
const TRADE_LINK_PATTERN = /^\/dashboard\/trades\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/**
 * Resolves a notification's stored `link` to a destination that is safe to
 * redirect to right now - server-side, using the caller's own session (no
 * service role), re-validating everything at click time rather than
 * trusting whatever was true when the notification was created:
 *
 * 1. The link must match a known, supported shape (currently: a trade
 *    detail page) - otherwise it's null/malformed/unsupported.
 * 2. The referenced trade must still exist - otherwise it was deleted
 *    (e.g. by an admin) since the notification was created.
 * 3. The current user must still be a participant on that trade - this is
 *    normally always true (only participants are ever notified about a
 *    trade), but is re-checked explicitly rather than assumed, and matters
 *    if RLS ever grants broader visibility (e.g. to admins) than what a
 *    notification's own recipient should be redirected into.
 *
 * Returns the validated link to redirect to, or `null` if the caller should
 * fall back to `/dashboard/notifications` instead.
 */
export async function resolveNotificationTarget(
  supabase: SupabaseClient<Database>,
  notification: Pick<Notification, "link">,
  userId: string
): Promise<string | null> {
  const link = notification.link;
  if (!link) return null;

  const match = link.match(TRADE_LINK_PATTERN);
  if (!match) return null;
  const tradeId = match[1];

  const { data: trade } = await supabase
    .from("trade_requests")
    .select("id, from_user_id, to_user_id")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) return null;
  if (trade.from_user_id !== userId && trade.to_user_id !== userId) return null;

  return link;
}
