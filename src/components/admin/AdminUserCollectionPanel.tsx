"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { AdminUserCollectionDetail, StickerRowState } from "@/lib/data/admin";

const STATE_LABELS: Record<StickerRowState, string> = {
  none: "לא מסומן",
  missing: "חסר",
  owned: "יש (ללא כפולות)",
  owned_with_duplicates: "יש + כפולות",
};

const STATE_BADGE_CLASS: Record<StickerRowState, string> = {
  none: "bg-black/5 text-foreground/50",
  missing: "bg-red-100 text-red-700",
  owned: "bg-green-100 text-green-700",
  owned_with_duplicates: "bg-blue-100 text-blue-700",
};

type SortKey = "code" | "team" | "state" | "quantity";
type StateFilter = "all" | StickerRowState;

/** Admin-only, read-only breakdown of a single collector's collection - see requirement #5. Never used outside /admin. */
export function AdminUserCollectionPanel({ detail }: { detail: AdminUserCollectionDetail }) {
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");

  const filteredStickers = useMemo(() => {
    const term = search.trim().toUpperCase();
    let rows = detail.stickers;
    if (teamFilter !== "all") rows = rows.filter((s) => s.teamCode === teamFilter);
    if (stateFilter !== "all") rows = rows.filter((s) => s.state === stateFilter);
    if (term) rows = rows.filter((s) => s.code.includes(term));

    // Every tiebreak/default falls back to team + numeric in-team number,
    // never the code *string* - "FWC-10" must sort after "FWC-9", not
    // between "FWC-1" and "FWC-2" the way a plain string comparison would
    // place it (and every ordinary team has the same issue past sticker 9).
    const byTeamThenNumber = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      a.teamCode.localeCompare(b.teamCode) || a.number - b.number;

    const sorted = [...rows];
    switch (sortKey) {
      case "team":
        sorted.sort(byTeamThenNumber);
        break;
      case "state":
        sorted.sort((a, b) => a.state.localeCompare(b.state) || byTeamThenNumber(a, b));
        break;
      case "quantity":
        sorted.sort((a, b) => (b.quantity ?? -1) - (a.quantity ?? -1) || byTeamThenNumber(a, b));
        break;
      default:
        sorted.sort(byTeamThenNumber);
    }
    return sorted;
  }, [detail.stickers, teamFilter, stateFilter, search, sortKey]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MiniStat label="השלמת אלבום" value={`${detail.completionPct}%`} />
        <MiniStat label="מדבקות ברשות" value={detail.ownedUnique} />
        <MiniStat label="חסרות" value={detail.missingUnique} />
        <MiniStat label="עם כפולות" value={detail.duplicateUnique} />
        <MiniStat label="סה״כ עותקי כפולות" value={detail.totalDuplicateCopies} />
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-bold text-foreground/70">פירוט לפי נבחרת</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {detail.teams.map((team) => (
            <button
              key={team.code}
              type="button"
              onClick={() => setTeamFilter(teamFilter === team.code ? "all" : team.code)}
              className={cn(
                "rounded-xl border p-2.5 text-right transition",
                teamFilter === team.code ? "border-brand bg-brand/5" : "border-black/10 bg-white hover:bg-black/[0.02]"
              )}
            >
              <p className="truncate text-xs font-bold">{team.nameHe}</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                <div className="h-full rounded-full bg-brand" style={{ width: `${team.completionPct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">
                {team.owned}/{team.total} · {team.completionPct}%
                {team.duplicateCopies > 0 && <span className="text-blue-600"> · ×{team.duplicateCopies}</span>}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-foreground/70">כל המדבקות</h3>
          {teamFilter !== "all" && (
            <button
              type="button"
              onClick={() => setTeamFilter("all")}
              className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand-dark"
            >
              {teamFilter} ✕
            </button>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש קוד מדבקה (למשל GER-2)"
            className="ms-auto min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-1.5 text-sm sm:max-w-56"
          />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as StateFilter)}
            className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
          >
            <option value="all">כל הסטטוסים</option>
            <option value="owned">יש (ללא כפולות)</option>
            <option value="owned_with_duplicates">יש + כפולות</option>
            <option value="missing">חסר</option>
            <option value="none">לא מסומן</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
          >
            <option value="code">מיון: קוד מדבקה</option>
            <option value="team">מיון: נבחרת</option>
            <option value="state">מיון: סטטוס</option>
            <option value="quantity">מיון: כמות</option>
          </select>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-xl border border-black/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/[0.03] text-xs text-foreground/50">
              <tr>
                <th className="p-2 text-right">קוד</th>
                <th className="p-2 text-right">נבחרת</th>
                <th className="p-2 text-right">כמות</th>
                <th className="p-2 text-right">כפולות זמינות</th>
                <th className="p-2 text-right">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filteredStickers.map((s) => (
                <tr key={s.code} className="border-t border-black/5">
                  <td className="p-2 font-bold" dir="ltr">
                    {s.code}
                  </td>
                  <td className="p-2 text-foreground/60">{s.teamNameHe}</td>
                  <td className="p-2">{s.quantity ?? "–"}</td>
                  <td className="p-2">{s.quantity === null ? "–" : s.availableDuplicates}</td>
                  <td className="p-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATE_BADGE_CLASS[s.state])}>
                      {STATE_LABELS[s.state]}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredStickers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-sm text-foreground/50">
                    לא נמצאו מדבקות התואמות את הסינון.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/[0.03] p-3 text-center">
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-xs font-medium text-foreground/60">{label}</p>
    </div>
  );
}
