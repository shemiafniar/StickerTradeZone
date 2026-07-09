import Link from "next/link";
import { getMatchesForCurrentUser } from "@/lib/data/matches";
import { MatchesView } from "@/components/matches/MatchesView";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "התאמות | Shashot" };

export default async function MatchesPage() {
  const { matches, myCity, locationEnabled } = await getMatchesForCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-extrabold">מצא טריידים קרובים</h1>
      <p className="mb-4 text-sm text-foreground/60">
        {locationEnabled
          ? "ממוין לפי מרחק אמיתי ממך, ואז לפי כמות התאמה - כולל תצוגת מפה"
          : myCity
            ? `מציגים אספנים לפי קרבה ל${myCity} וציון התאמה`
            : "עדכנו את העיר שלכם בפרופיל כדי לשפר את הדירוג"}
      </p>

      {!locationEnabled && (
        <Card className="mb-5 border-brand/20 bg-brand/5">
          <p className="text-sm font-bold text-brand-dark">📍 רוצה התאמות מדויקות יותר?</p>
          <p className="mt-1 text-sm text-foreground/70">
            הפעילו מיקום מקורב בעמוד{" "}
            <Link href="/dashboard/profile" className="font-bold text-brand-dark underline">
              הפרופיל שלי
            </Link>{" "}
            כדי לראות מרחק אמיתי לכל אספן, לקבל את ההתאמות הקרובות ביותר קודם, ולראות אותן על המפה.
          </p>
        </Card>
      )}

      {matches.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground/60">
            עדיין לא נמצאו התאמות. ודאו שסימנתם מדבקות כפולות וחסרות בעמוד{" "}
            <Link href="/dashboard/stickers" className="font-bold text-brand-dark">
              המדבקות שלי
            </Link>
            , ונסו שוב בקרוב - יותר אספנים מצטרפים כל הזמן!
          </p>
        </Card>
      ) : (
        <MatchesView matches={matches} locationEnabled={locationEnabled} />
      )}
    </div>
  );
}
