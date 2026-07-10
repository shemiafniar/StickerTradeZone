import { getCurrentProfile } from "@/lib/data/profile";
import { getNotifications, getUnreadNotificationCount } from "@/lib/data/notifications";
import { NotificationsProvider } from "@/components/notifications/NotificationsContext";

/**
 * Root-layout-level data fetch for the shared notifications store - see
 * NotificationsContext.tsx for why this needs to be a single provider
 * wrapping the whole app (header + page content) rather than state local
 * to the header's bell.
 */
export async function NotificationsRootProvider({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  const [notifications, unreadCount] = profile
    ? await Promise.all([getNotifications(100), getUnreadNotificationCount()])
    : [[], 0];

  return (
    <NotificationsProvider userId={profile?.id ?? null} initialNotifications={notifications} initialUnreadCount={unreadCount}>
      {children}
    </NotificationsProvider>
  );
}
