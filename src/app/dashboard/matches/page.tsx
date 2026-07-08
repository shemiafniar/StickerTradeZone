import { getMatchesForCurrentUser } from "@/lib/data/matches";
import { MatchCard } from "@/components/matches/MatchCard";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "התאמות | Sticker Trade IL" };

export default async function MatchesPage() {
  const { matches, myCity } = await getMatchesForCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-extrabold">מצא טריידים קרובים</h1>
      <p className="mb-6 text-sm text-foreground/60">
        {myCity ? `מציגים אספנים לפי קרבה ל${myCity} וציון התאמה` : "עדכנו את העיר שלכם בפרופיל כדי לשפר את הדירוג"}
      </p>

      {matches.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground/60">
            עדיין לא נמצאו התאמות. ודאו שסימנתם מדבקות כפולות וחסרות בעמוד{" "}
            <span className="font-bold">המדבקות שלי</span>, ונסו שוב בקרוב - יותר אספנים מצטרפים
            כל הזמן!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {matches.map((match) => (
            <MatchCard key={match.userId} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
