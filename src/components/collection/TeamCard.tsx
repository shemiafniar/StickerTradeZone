import Link from "next/link";
import type { TeamProgress } from "@/lib/data/collection";

export function TeamCard({ team }: { team: TeamProgress }) {
  const owned = team.have + team.duplicate;
  const pct = team.total > 0 ? Math.round((owned / team.total) * 100) : 0;
  const isComplete = owned >= team.total;

  return (
    <Link
      href={`/dashboard/stickers/${team.code.toLowerCase()}`}
      className="block rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">{team.flag_emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">{team.name_he}</p>
          <p className="text-xs font-bold tracking-wide text-foreground/40">{team.code}</p>
        </div>
        {isComplete && <span title="האלבום הושלם">✅</span>}
      </div>

      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-foreground/50">
          <span>
            {owned}/{team.total}
          </span>
          {team.missing > 0 && <span className="font-bold text-red-500">{team.missing} חסרות</span>}
        </div>
      </div>
    </Link>
  );
}
