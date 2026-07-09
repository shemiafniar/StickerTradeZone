import { getAdminStatistics } from "@/lib/data/admin";
import { Card } from "@/components/ui/Card";
import { StickerBarList, DailyBarChart } from "@/components/admin/StatCharts";

export const metadata = { title: "סטטיסטיקות | Shashot" };

export default async function AdminStatisticsPage() {
  const stats = await getAdminStatistics();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">סטטיסטיקות</h1>
      <p className="mb-6 text-sm text-foreground/60">כל הנתונים מחושבים בזמן אמת מתוך מסד הנתונים</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">🔴 המדבקות המבוקשות ביותר</h2>
          <StickerBarList items={stats.mostWantedStickers} color="bg-red-500" />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">🟢 המדבקות הנפוצות ביותר</h2>
          <StickerBarList items={stats.mostCommonStickers} color="bg-green-500" />
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-lg font-bold">🏆 האספנים הפעילים ביותר</h2>
        {stats.mostActiveTraders.length === 0 ? (
          <p className="text-sm text-foreground/50">אין עדיין מספיק נתונים.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.mostActiveTraders.map((trader, index) => (
              <div
                key={trader.userId}
                className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2"
              >
                <span className="text-sm font-bold">
                  {index + 1}. {trader.fullName}
                </span>
                <span className="text-sm font-extrabold text-brand-dark">{trader.count} טריידים</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 text-lg font-bold">📈 טריידים חדשים ליום (14 יום אחרונים)</h2>
        <DailyBarChart data={stats.tradesPerDay} color="bg-brand" />
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 text-lg font-bold">👥 צמיחת משתמשים (14 יום אחרונים)</h2>
        <DailyBarChart data={stats.userGrowth} color="bg-blue-500" />
      </Card>
    </div>
  );
}
