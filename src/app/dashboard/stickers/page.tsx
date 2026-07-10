import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { getTeamsWithProgress } from "@/lib/data/collection";
import { getAppSettings } from "@/lib/data/stickers";
import { TeamCard } from "@/components/collection/TeamCard";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "האוסף שלי" };

export default async function StickersPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [teams, settings] = await Promise.all([getTeamsWithProgress(profile.id), getAppSettings()]);

  const totalOwned = teams.reduce((sum, t) => sum + t.owned, 0);
  const totalStickers = teams.reduce((sum, t) => sum + t.total, 0);
  const totalMissing = teams.reduce((sum, t) => sum + t.missing, 0);
  const totalDuplicateCopies = teams.reduce((sum, t) => sum + t.duplicateCopies, 0);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">האוסף שלי 📖</h1>
          <p className="text-sm text-foreground/60">
            {settings.set_name} · {totalOwned}/{totalStickers} מדבקות
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/stickers/marketplace"
            className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold text-foreground/70 transition hover:bg-black/5"
          >
            🔁 הכפולים שלי ({totalDuplicateCopies})
          </Link>
          <Link
            href="/dashboard/scanner"
            className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark"
          >
            🤖 סריקת מדבקות
          </Link>
        </div>
      </div>

      {totalOwned === 0 && (
        <Card className="mb-5 border-brand/20 bg-brand/5">
          <p className="font-bold text-brand-dark">👋 בחרו נבחרת כדי להתחיל!</p>
          <p className="mt-1 text-sm text-foreground/70">
            הקישו על כרטיס נבחרת כדי לפתוח את רשת המדבקות שלה ולסמן מה יש לכם - או נסו את{" "}
            <Link href="/dashboard/scanner" className="font-bold text-brand-dark underline">
              סורק ה-AI
            </Link>{" "}
            כדי לסמן הרבה מדבקות בבת אחת.
          </p>
        </Card>
      )}

      {totalMissing > 0 && (
        <p className="mb-4 text-sm font-medium text-foreground/60">
          חסרות לכם <span className="font-bold text-red-600">{totalMissing}</span> מדבקות באלבום -{" "}
          <Link href="/dashboard/matches" className="font-bold text-brand-dark underline">
            חפשו התאמות
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {teams.map((team) => (
          <TeamCard key={team.code} team={team} />
        ))}
      </div>
    </div>
  );
}
