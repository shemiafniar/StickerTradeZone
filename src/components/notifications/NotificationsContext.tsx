"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import type { Notification } from "@/types/database";

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  isMarkingAll: boolean;
  markAsRead: (notificationId: string) => Promise<{ error?: string }>;
  markAllAsRead: () => Promise<{ error?: string }>;
  /**
   * The single, shared "a notification was clicked" behavior - used by both
   * NotificationBell and NotificationHistoryList so they can never diverge
   * again. Navigates immediately to the server-validated redirect route
   * (`/dashboard/notifications/go/{id}`), which re-checks the target itself
   * and falls back safely if it's gone - and *separately* attempts to mark
   * the notification read for the optimistic badge update. The two are
   * intentionally decoupled: navigation is fired synchronously and never
   * waits on (or is blocked by) the mark-as-read call, whose result is only
   * returned so a caller can surface an error message if it wants to.
   */
  openNotification: (notification: Notification) => Promise<{ error?: string }>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * Single source of truth for notifications, shared between the header bell
 * (`NotificationBell`) and the full history page (`NotificationHistoryList`)
 * - both are independent client components mounted as siblings under the
 * root layout, so without a shared store, an action taken in one (e.g.
 * "mark all as read" on the notifications page) had no way to update the
 * other (the header's unread badge) except by hoping a full server
 * round-trip + re-render happened to reach both before the user noticed.
 * Lifting the state here makes every consumer update in lock-step,
 * synchronously, regardless of navigation/revalidation timing.
 */
export function NotificationsProvider({
  userId,
  initialNotifications,
  initialUnreadCount,
  children,
}: {
  userId: string | null;
  initialNotifications: Notification[];
  initialUnreadCount: number;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const router = useRouter();

  // Re-sync from fresh server-fetched props (e.g. after a full navigation)
  // without discarding in-flight optimistic state from an effect - this is
  // React's documented "adjust state during render" pattern.
  const [synced, setSynced] = useState({ initialNotifications, initialUnreadCount });
  if (synced.initialNotifications !== initialNotifications || synced.initialUnreadCount !== initialUnreadCount) {
    setSynced({ initialNotifications, initialUnreadCount });
    setNotifications(initialNotifications);
    setUnreadCount(initialUnreadCount);
  }

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const notification = payload.new as Notification;
          setNotifications((prev) => [notification, ...prev].slice(0, 100));
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    let wasUnread = false;
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== notificationId) return n;
        wasUnread = !n.read_at;
        return n.read_at ? n : { ...n, read_at: new Date().toISOString() };
      })
    );
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));

    const result = await markNotificationReadAction(notificationId);
    if (result.error) {
      // Roll back the optimistic update so the UI doesn't lie about what's
      // actually persisted server-side.
      if (wasUnread) {
        setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read_at: null } : n)));
        setUnreadCount((prev) => prev + 1);
      }
      return { error: result.error };
    }
    return {};
  }, []);

  const markAllAsRead = useCallback(async () => {
    setIsMarkingAll(true);
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnreadCount(0);

    const result = await markAllNotificationsReadAction();
    setIsMarkingAll(false);

    if (result.error) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      return { error: result.error };
    }
    return {};
  }, [notifications, unreadCount]);

  const openNotification = useCallback(
    (notification: Notification) => {
      // Fired synchronously, before awaiting anything below - a slow or
      // failed mark-as-read call must never delay or block this.
      router.push(`/dashboard/notifications/go/${notification.id}`);
      return markAsRead(notification.id);
    },
    [router, markAsRead]
  );

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isMarkingAll, markAsRead, markAllAsRead, openNotification }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return ctx;
}
