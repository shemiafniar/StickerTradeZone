import Link from "next/link";
import { getNotifications } from "@/lib/data/notifications";
import { Card } from "@/components/ui/Card";
import { NotificationHistoryList } from "@/components/notifications/NotificationHistoryList";

export const metadata = { title: "התראות | Shashot" };

const notificationIcons: Record<string, string> = {
  trade_request_received: "🤝",
  trade_accepted: "✅",
  trade_declined: "❌",
  new_message: "💬",
  new_match: "📍",
};

export default async function NotificationsPage() {
  const notifications = await getNotifications(100);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-extrabold">התראות</h1>
      <p className="mb-6 text-sm text-foreground/60">היסטוריית כל ההתראות שלך</p>

      {notifications.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground/60">
            אין עדיין התראות. ברגע שמישהו ישלח לך בקשת טרייד או הודעה, תראו אותה כאן.{" "}
            <Link href="/dashboard/matches" className="font-bold text-brand-dark">
              מצאו טריידים קרובים
            </Link>
          </p>
        </Card>
      ) : (
        <NotificationHistoryList notifications={notifications} icons={notificationIcons} />
      )}
    </div>
  );
}
