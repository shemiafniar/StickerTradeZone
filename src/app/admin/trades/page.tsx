import Link from "next/link";
import { getAdminTrades } from "@/lib/data/admin";
import { Card } from "@/components/ui/Card";
import { TradeStatusBadge } from "@/components/ui/Badge";
import { AdminTradeActions } from "@/components/admin/AdminTradeActions";
import { formatStickerCodesByTeam } from "@/lib/stickerCodes";

export const metadata = { title: "ניהול טריידים" };

export default async function AdminTradesPage() {
  const trades = await getAdminTrades();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">ניהול טריידים</h1>
      <p className="mb-6 text-sm text-foreground/60">סה&quot;כ {trades.length} בקשות טרייד במערכת</p>

      <div className="flex flex-col gap-3">
        {trades.map((trade) => (
          <Card key={trade.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/users/${trade.from_user_id}`} className="font-bold text-brand-dark hover:underline">
                    {trade.fromUser?.full_name ?? "אספן"}
                  </Link>
                  <span className="text-foreground/40">←→</span>
                  <Link href={`/admin/users/${trade.to_user_id}`} className="font-bold text-brand-dark hover:underline">
                    {trade.toUser?.full_name ?? "אספן"}
                  </Link>
                  <TradeStatusBadge status={trade.status} />
                </div>
                <p className="mt-1 text-xs text-foreground/50">
                  נוצר ב-{new Date(trade.created_at).toLocaleDateString("he-IL")}
                </p>

                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                  <span className="text-foreground/70" dir="ltr">
                    {trade.fromUser?.full_name ?? "השולח"} נותן: {formatStickerCodesByTeam(trade.itemsGivenByFromUser) || "-"}
                  </span>
                  <span className="text-foreground/70" dir="ltr">
                    {trade.fromUser?.full_name ?? "השולח"} מקבל: {formatStickerCodesByTeam(trade.itemsReceivedByFromUser) || "-"}
                  </span>
                </div>
              </div>

              <AdminTradeActions tradeId={trade.id} status={trade.status} />
            </div>
          </Card>
        ))}

        {trades.length === 0 && (
          <Card>
            <p className="text-sm text-foreground/60">אין עדיין בקשות טרייד במערכת.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
