import { getAdminStats } from "@/lib/data/admin";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "אזור ניהול | Sticker Trade IL" };

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();

  const items = [
    { label: "סה\"כ משתמשים", value: stats.totalUsers, icon: "👥" },
    { label: "משתמשים פעילים", value: stats.activeUsers, icon: "✅" },
    { label: "משתמשים מושעים", value: stats.suspendedUsers, icon: "⛔" },
    { label: "סה\"כ מדבקות כפולות", value: stats.totalDuplicates, icon: "🔁" },
    { label: "סה\"כ מדבקות חסרות", value: stats.totalMissing, icon: "📋" },
    { label: "בקשות טרייד סה\"כ", value: stats.totalTradeRequests, icon: "🤝" },
    { label: "בקשות ממתינות", value: stats.pendingTradeRequests, icon: "⏳" },
    { label: "טריידים שהושלמו", value: stats.completedTradeRequests, icon: "🏆" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">סקירה כללית</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => (
          <Card key={item.label}>
            <div className="mb-2 text-2xl">{item.icon}</div>
            <p className="text-2xl font-extrabold">{item.value}</p>
            <p className="text-xs font-medium text-foreground/60">{item.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
