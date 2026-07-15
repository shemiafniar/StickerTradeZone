import { NotificationHistoryList } from "@/components/notifications/NotificationHistoryList";

export const metadata = { title: "התראות" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ unavailable?: string }>;
}) {
  const { unavailable } = await searchParams;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-extrabold">התראות</h1>
      <p className="mb-6 text-sm text-foreground/60">היסטוריית כל ההתראות שלך</p>

      <NotificationHistoryList targetUnavailable={unavailable === "1"} />
    </div>
  );
}
