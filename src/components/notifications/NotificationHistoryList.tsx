"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications/NotificationsContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Notification } from "@/types/database";

const notificationIcons: Record<string, string> = {
  trade_request_received: "🤝",
  trade_accepted: "✅",
  trade_declined: "❌",
  new_message: "💬",
  new_match: "📍",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export function NotificationHistoryList() {
  const { notifications, isMarkingAll, markAsRead, markAllAsRead } = useNotifications();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const hasUnread = notifications.some((n) => !n.read_at);

  async function handleClick(notification: Notification) {
    setError(null);
    if (!notification.read_at) {
      const result = await markAsRead(notification.id);
      if (result.error) {
        setError(result.error);
        return;
      }
    }
    if (notification.link) router.push(notification.link);
  }

  async function handleMarkAllRead() {
    setError(null);
    const result = await markAllAsRead();
    if (result.error) setError(result.error);
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <p className="text-sm text-foreground/60">
          אין עדיין התראות. ברגע שמישהו ישלח לך בקשת טרייד או הודעה, תראו אותה כאן.{" "}
          <Link href="/dashboard/matches" className="font-bold text-brand-dark">
            מצאו טריידים קרובים
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {hasUnread && (
        <div className="mb-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isMarkingAll}>
            {isMarkingAll ? "מסמן..." : "סמן הכל כנקרא"}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {notifications.map((notification) => (
          <button key={notification.id} onClick={() => handleClick(notification)} className="text-right">
            <Card className={!notification.read_at ? "border-brand/30 bg-brand/5" : undefined}>
              <div className="flex items-start gap-3">
                <span className="text-xl">{notificationIcons[notification.type] ?? "🔔"}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold">{notification.title}</p>
                  {notification.body && <p className="mt-0.5 text-sm text-foreground/60">{notification.body}</p>}
                  <p className="mt-1 text-xs text-foreground/40">{formatDateTime(notification.created_at)}</p>
                </div>
                {!notification.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
