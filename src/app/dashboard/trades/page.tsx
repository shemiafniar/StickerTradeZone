import Link from "next/link";
import { getTradeRequestsForCurrentUser } from "@/lib/data/trades";
import { getUnreadMessageCounts } from "@/lib/data/chat";
import { Card } from "@/components/ui/Card";
import { TradeStatusBadge } from "@/components/ui/Badge";

export const metadata = { title: "טריידים | Sticker Trade IL" };

export default async function TradesPage() {
  const [trades, unreadCounts] = await Promise.all([
    getTradeRequestsForCurrentUser(),
    getUnreadMessageCounts(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold">בקשות הטרייד שלי</h1>
      <p className="mb-6 text-sm text-foreground/60">כל הבקשות שנשלחו ושהתקבלו אצלך</p>

      {trades.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground/60">
            אין עדיין בקשות טרייד. עברו לעמוד{" "}
            <Link href="/dashboard/matches" className="font-bold text-brand-dark">
              ההתאמות
            </Link>{" "}
            כדי למצוא אספנים קרובים.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {trades.map((trade) => (
            <Link key={trade.id} href={`/dashboard/trades/${trade.id}`}>
              <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-extrabold">{trade.otherUser?.full_name ?? "אספן"}</p>
                    <p className="text-xs text-foreground/50">
                      {trade.isSender ? "בקשה שנשלחה" : "בקשה שהתקבלה"} ·{" "}
                      {new Date(trade.created_at).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(unreadCounts.get(trade.id) ?? 0) > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                        {unreadCounts.get(trade.id)}
                      </span>
                    )}
                    <TradeStatusBadge status={trade.status} />
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-foreground/60">
                  <span>מקבל: {trade.itemsToReceive.length} מדבקות</span>
                  <span>נותן: {trade.itemsToGive.length} מדבקות</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
