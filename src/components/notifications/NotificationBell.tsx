"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications/NotificationsContext";
import { useClickOutside } from "@/lib/useClickOutside";
import type { Notification } from "@/types/database";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

const notificationIcons: Record<string, string> = {
  trade_request_received: "🤝",
  trade_accepted: "✅",
  trade_declined: "❌",
  new_message: "💬",
  new_match: "📍",
};

const BELL_DROPDOWN_LIMIT = 15;

export function NotificationBell() {
  const { notifications, unreadCount, isMarkingAll, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useClickOutside(containerRef, () => setOpen(false));

  async function handleNotificationClick(notification: Notification) {
    if (!notification.read_at) {
      const result = await markAsRead(notification.id);
      if (result.error) setError(result.error);
    }
    setOpen(false);
    if (notification.link) router.push(notification.link);
    else router.refresh();
  }

  async function handleMarkAllRead() {
    setError(null);
    const result = await markAllAsRead();
    if (result.error) setError(result.error);
  }

  const visibleNotifications = notifications.slice(0, BELL_DROPDOWN_LIMIT);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-foreground/70 transition hover:bg-black/5"
        aria-label="התראות"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-16 z-40 rounded-2xl border border-black/10 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-80">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <p className="text-sm font-bold">התראות</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="text-xs font-bold text-brand-dark disabled:opacity-50"
              >
                {isMarkingAll ? "מסמן..." : "סמן הכל כנקרא"}
              </button>
            )}
          </div>

          {error && <p className="border-b border-black/5 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">{error}</p>}

          <div className="max-h-96 overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-foreground/50">אין עדיין התראות</p>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex w-full items-start gap-2.5 border-b border-black/5 px-4 py-3 text-right transition hover:bg-black/[0.02] ${
                    !notification.read_at ? "bg-brand/5" : ""
                  }`}
                >
                  <span className="text-lg">{notificationIcons[notification.type] ?? "🔔"}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{notification.title}</span>
                    {notification.body && (
                      <span className="mt-0.5 block text-xs text-foreground/60 line-clamp-2">{notification.body}</span>
                    )}
                    <span className="mt-1 block text-[11px] text-foreground/40">{timeAgo(notification.created_at)}</span>
                  </span>
                  {!notification.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-black/5 p-2 text-center">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-xs font-bold text-brand-dark">
              לכל ההתראות
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
