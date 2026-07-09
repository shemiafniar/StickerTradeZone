import Link from "next/link";
import { getAdminStats } from "@/lib/data/admin";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "אזור ניהול | Shashot" };

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();

  const items = [
    { label: "סה\"כ משתמשים רשומים", value: stats.totalUsers, icon: "👥" },
    { label: "משתמשים פעילים", value: stats.activeUsers, icon: "✅" },
    { label: "משתמשים מושעים", value: stats.suspendedUsers, icon: "⛔" },
    { label: "משתמשים עם מיקום מופעל", value: stats.usersWithLocation, icon: "📍" },
    { label: "סה\"כ טריידים", value: stats.totalTradeRequests, icon: "🤝" },
    { label: "טריידים פתוחים", value: stats.pendingTradeRequests, icon: "⏳" },
    { label: "טריידים שהושלמו", value: stats.completedTradeRequests, icon: "🏆" },
    { label: "סה\"כ התאמות פעילות", value: stats.totalMatches, icon: "🔗" },
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/admin/users">
          <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-2xl">👥</p>
            <p className="mt-1 font-bold">ניהול משתמשים</p>
            <p className="text-xs text-foreground/60">חיפוש, צפייה, עריכה, השעיה ומחיקה</p>
          </Card>
        </Link>
        <Link href="/admin/trades">
          <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-2xl">🤝</p>
            <p className="mt-1 font-bold">ניהול טריידים</p>
            <p className="text-xs text-foreground/60">צפייה בכל הטריידים במערכת, ביטול/השלמה/מחיקה</p>
          </Card>
        </Link>
        <Link href="/admin/statistics">
          <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-2xl">📊</p>
            <p className="mt-1 font-bold">סטטיסטיקות</p>
            <p className="text-xs text-foreground/60">מדבקות מבוקשות, אספנים פעילים, צמיחה</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
