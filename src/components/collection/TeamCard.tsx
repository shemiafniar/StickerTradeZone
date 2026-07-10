import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TeamFlag } from "@/components/collection/TeamFlag";
import type { TeamProgress } from "@/lib/data/collection";

export function TeamCard({ team }: { team: TeamProgress }) {
  const pct = team.total > 0 ? Math.round((team.owned / team.total) * 100) : 0;
  const isComplete = team.owned >= team.total;

  return (
    <Link href={`/dashboard/stickers/${team.code.toLowerCase()}`} className="block">
      <Card interactive className="p-4">
        <div className="flex items-center gap-3">
          <TeamFlag flagIcon={team.flag_icon} flagEmoji={team.flag_emoji} />
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
              {team.owned}/{team.total}
            </span>
            {team.missing > 0 && <span className="font-bold text-red-500">{team.missing} חסרות</span>}
          </div>
        </div>
      </Card>
    </Link>
  );
}
