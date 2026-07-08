"use client";

import { useRouter } from "next/navigation";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Notification } from "@/types/database";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export function NotificationHistoryList({
  notifications,
  icons,
}: {
  notifications: Notification[];
  icons: Record<string, string>;
}) {
  const router = useRouter();
  const hasUnread = notifications.some((n) => !n.read_at);

  async function handleClick(notification: Notification) {
    if (!notification.read_at) await markNotificationReadAction(notification.id);
    if (notification.link) router.push(notification.link);
    else router.refresh();
  }

  return (
    <div>
      {hasUnread && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await markAllNotificationsReadAction();
              router.refresh();
            }}
          >
            סמן הכל כנקרא
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {notifications.map((notification) => (
          <button key={notification.id} onClick={() => handleClick(notification)} className="text-right">
            <Card className={!notification.read_at ? "border-brand/30 bg-brand/5" : undefined}>
              <div className="flex items-start gap-3">
                <span className="text-xl">{icons[notification.type] ?? "🔔"}</span>
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
