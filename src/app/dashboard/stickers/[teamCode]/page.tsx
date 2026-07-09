import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getTeamGrid } from "@/lib/data/collection";
import { StickerGrid } from "@/components/collection/StickerGrid";
import { TeamFlag } from "@/components/collection/TeamFlag";

export async function generateMetadata({ params }: { params: Promise<{ teamCode: string }> }) {
  const { teamCode } = await params;
  return { title: `${teamCode.toUpperCase()} | Shashot` };
}

export default async function TeamStickersPage({ params }: { params: Promise<{ teamCode: string }> }) {
  const { teamCode } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const grid = await getTeamGrid(profile.id, teamCode);
  if (!grid) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/dashboard/stickers"
        className="mb-3 inline-block text-sm font-bold text-foreground/50 transition hover:text-foreground"
      >
        ← חזרה לאוסף שלי
      </Link>

      <div className="mb-5 flex items-center gap-3">
        <TeamFlag flagIcon={grid.team.flag_icon} flagEmoji={grid.team.flag_emoji} size="lg" />
        <div>
          <h1 className="text-2xl font-extrabold">{grid.team.name_he}</h1>
          <p className="text-sm font-bold tracking-wide text-foreground/40">{grid.team.code}</p>
        </div>
      </div>

      <StickerGrid key={grid.team.code} teamCode={grid.team.code} initialCells={grid.cells} />
    </div>
  );
}
