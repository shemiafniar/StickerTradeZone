import Link from "next/link";
import { getMatchesForCurrentUser } from "@/lib/data/matches";
import { MatchesView } from "@/components/matches/MatchesView";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "התאמות" };

export default async function MatchesPage() {
  const { matches, myCity, locationEnabled, hasCollectionData } = await getMatchesForCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-extrabold">מצא טריידים קרובים</h1>
      <p className="mb-4 text-sm text-foreground/60">
        {locationEnabled
          ? "כאן תמצא אספנים שיכולים לעזור לך להשלים את האוסף, כאלה שאתה יכול לעזור להם, וגם הזדמנויות לטריידים הדדיים. ההתאמות ממוינות לפי קרבה ורמת ההתאמה."
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

      {matches.length === 0 && !hasCollectionData ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-bold text-amber-800">📖 האוסף שלכם עדיין ריק</p>
          <p className="mt-1 text-sm text-amber-900/80">
            כדי שנוכל למצוא לכם התאמות, סמנו קודם בעמוד{" "}
            <Link href="/dashboard/stickers" className="font-bold text-amber-900 underline">
              האוסף שלי
            </Link>{" "}
            אילו מדבקות יש לכם (כולל כפולות), ואילו חסרות לכם. ברגע שיהיו לכם כמה מדבקות מסומנות, נתחיל להציג כאן
            אספנים רלוונטיים.
          </p>
        </Card>
      ) : matches.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground/60">
            {locationEnabled
              ? "עדיין לא נמצאו התאמות קרובות - סימנתם כבר מדבקות באוסף, אבל אף אספן/ת קרוב/ה לא צריך/ה בדיוק את מה שיש לכם (או להפך) כרגע."
              : "עדיין לא נמצאו התאמות. "}
            נסו שוב בקרוב - יותר אספנים מצטרפים כל הזמן, ואפשר גם{" "}
            <Link href="/dashboard/stickers" className="font-bold text-brand-dark">
              להוסיף עוד מדבקות וכפולות
            </Link>{" "}
            כדי להגדיל את הסיכוי להתאמה.
          </p>
        </Card>
      ) : (
        <MatchesView matches={matches} locationEnabled={locationEnabled} />
      )}
    </div>
  );
}
