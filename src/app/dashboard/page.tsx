import { getCurrentProfile } from "@/lib/data/profile";
import { getCollectionCounts } from "@/lib/data/collection";
import { getMatchesForCurrentUser } from "@/lib/data/matches";
import { getTradeRequestsForCurrentUser } from "@/lib/data/trades";
import { SummaryCard } from "@/components/SummaryCard";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { TradeStatusBadge } from "@/components/ui/Badge";
import { ShareCard } from "@/components/share/ShareCard";
import Link from "next/link";

export const metadata = { title: "לוח בקרה | Sticker Trade IL" };

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [counts, { matches }, trades] = await Promise.all([
    getCollectionCounts(profile.id),
    getMatchesForCurrentUser(),
    getTradeRequestsForCurrentUser(),
  ]);

  const pendingIncoming = trades.filter((t) => t.status === "pending" && !t.isSender);
  const recentTrades = trades.slice(0, 4);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">שלום, {profile.full_name || "אספן"} 👋</h1>
          <p className="text-sm text-foreground/60">
            {profile.city}
            {profile.neighborhood ? ` · ${profile.neighborhood}` : ""}
          </p>
        </div>
        <LinkButton href="/dashboard/matches">מצא טריידים קרובים</LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon="📋" label="מדבקות שחסרות לי" value={counts.missing} href="/dashboard/stickers?tab=missing" accent="orange" />
        <SummaryCard icon="🔁" label="מדבקות כפולות" value={counts.duplicates} href="/dashboard/stickers?tab=duplicates" accent="green" />
        <SummaryCard icon="📍" label="התאמות קרובות" value={matches.length} href="/dashboard/matches" accent="blue" />
      </div>

      {counts.missing === 0 && counts.duplicates === 0 && (
        <Card className="mt-6 border-brand/20 bg-brand/5">
          <p className="font-bold text-brand-dark">👋 עוד לא סימנת מדבקות - בואו נתחיל!</p>
          <p className="mt-1 text-sm text-foreground/70">
            הדרך המהירה ביותר: צלמו את הכפולים או עמוד באלבום עם{" "}
            <Link href="/dashboard/scanner" className="font-bold text-brand-dark underline">
              סורק ה-AI
            </Link>
            . אפשר גם להזין ידנית בעמוד{" "}
            <Link href="/dashboard/stickers" className="font-bold text-brand-dark underline">
              המדבקות שלי
            </Link>
            .
          </p>
        </Card>
      )}

      {pendingIncoming.length > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <p className="font-bold text-amber-800">
            יש לך {pendingIncoming.length} בקשות טרייד חדשות שממתינות לתשובה!
          </p>
          <Link href="/dashboard/trades" className="mt-1 inline-block text-sm font-bold text-amber-900 underline">
            לצפייה בבקשות
          </Link>
        </Card>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">טריידים אחרונים</h2>
          <Link href="/dashboard/trades" className="text-sm font-bold text-brand-dark">
            לכל הטריידים
          </Link>
        </div>

        {recentTrades.length === 0 ? (
          <Card>
            <p className="text-sm text-foreground/60">
              עדיין אין לך בקשות טרייד. עברו לעמוד ההתאמות כדי למצוא אספנים קרובים!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentTrades.map((trade) => (
              <Link key={trade.id} href={`/dashboard/trades/${trade.id}`}>
                <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{trade.otherUser?.full_name ?? "אספן"}</p>
                    <TradeStatusBadge status={trade.status} />
                  </div>
                  <p className="mt-1 text-sm text-foreground/60">
                    {trade.isSender ? "בקשה שנשלחה על ידך" : "בקשה שהתקבלה"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <ShareCard />
      </div>
    </div>
  );
}
