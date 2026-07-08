import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LOCATION_RANK_LABEL } from "@/lib/cities";
import { formatDistanceHebrew } from "@/lib/distance";
import { formatStickerCodesByTeam, serializeStickerCodes } from "@/lib/stickerCodes";
import type { MatchResult } from "@/lib/matching";

export function MatchCard({ match }: { match: MatchResult }) {
  const giveParam = encodeURIComponent(serializeStickerCodes(match.theyNeedThatIHave));
  const receiveParam = encodeURIComponent(serializeStickerCodes(match.theyHaveThatINeed));

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-extrabold">{match.fullName}</p>
          <p className="text-sm text-foreground/60">
            {match.city}
            {match.neighborhood ? ` · ${match.neighborhood}` : ""}
          </p>
        </div>
        {match.distanceKm !== null ? (
          <Badge className="bg-brand/10 text-brand-dark">📍 {formatDistanceHebrew(match.distanceKm)}</Badge>
        ) : (
          <Badge className={match.locationRank === 0 ? "bg-brand/10 text-brand-dark" : undefined}>
            {LOCATION_RANK_LABEL[match.locationRank]}
          </Badge>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-green-50 p-3">
          <p className="text-xs font-bold text-green-700">תקבל ממנו/ה</p>
          <p className="text-2xl font-extrabold text-green-800">{match.theyHaveThatINeed.length}</p>
          <p
            className="mt-1 truncate text-xs text-green-700/70"
            title={formatStickerCodesByTeam(match.theyHaveThatINeed)}
          >
            {formatStickerCodesByTeam(match.theyHaveThatINeed) || "-"}
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3">
          <p className="text-xs font-bold text-blue-700">תיתן לו/ה</p>
          <p className="text-2xl font-extrabold text-blue-800">{match.theyNeedThatIHave.length}</p>
          <p
            className="mt-1 truncate text-xs text-blue-700/70"
            title={formatStickerCodesByTeam(match.theyNeedThatIHave)}
          >
            {formatStickerCodesByTeam(match.theyNeedThatIHave) || "-"}
          </p>
        </div>
      </div>

      {match.forSaleThatINeed.length > 0 && (
        <p className="mt-3 text-xs font-medium text-orange-700">
          💰 {match.forSaleThatINeed.length} מהמדבקות שחסרות לך זמינות אצלו/ה גם למכירה
          {match.forSaleThatINeed.some((s) => s.price != null) && (
            <>
              {" "}
              (החל מ-{Math.min(...match.forSaleThatINeed.filter((s) => s.price != null).map((s) => s.price!))}
              ₪)
            </>
          )}
        </p>
      )}

      <Link
        href={`/dashboard/trades/new?to=${match.userId}&give=${giveParam}&receive=${receiveParam}`}
        className="mt-4 block w-full rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-dark"
      >
        שלח בקשת טרייד
      </Link>
    </Card>
  );
}
