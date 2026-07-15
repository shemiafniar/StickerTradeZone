import { getTradeRequestsForCurrentUser } from "@/lib/data/trades";
import { getUnreadMessageCounts } from "@/lib/data/chat";
import { TradesList } from "@/components/trades/TradesList";

export const metadata = { title: "טריידים" };

export default async function TradesPage() {
  const [trades, unreadCounts] = await Promise.all([getTradeRequestsForCurrentUser(), getUnreadMessageCounts()]);

  // Map isn't a safe Server -> Client Component prop shape - converted to a
  // plain object for TradesList, which owns all the interactive filtering.
  const unreadCountsObject = Object.fromEntries(unreadCounts);

  return (
    <div>
      <h1 className="text-2xl font-extrabold">בקשות הטרייד שלי</h1>
      <p className="mb-6 text-sm text-foreground/60">כל הבקשות שנשלחו ושהתקבלו אצלך, כולל היסטוריה מלאה</p>

      <TradesList trades={trades} unreadCounts={unreadCountsObject} />
    </div>
  );
}
