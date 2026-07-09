import type { DailyCount, StickerStat } from "@/lib/data/admin";

/** Simple horizontal bar list - no charting library needed for a handful of ranked rows. */
export function StickerBarList({ items, color }: { items: StickerStat[]; color: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-foreground/50">אין עדיין מספיק נתונים.</p>;
  }
  const max = Math.max(...items.map((i) => i.count));

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={item.code} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-xs font-bold text-foreground/40">{index + 1}</span>
          <span className="w-16 shrink-0 text-xs font-bold" dir="ltr">
            {item.code}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-left text-xs font-extrabold">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

/** Minimal vertical bar chart for a daily time series, built from plain divs. */
export function DailyBarChart({ data, color }: { data: DailyCount[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-1" dir="ltr">
      {data.map((d) => (
        <div key={d.date} className="flex min-w-8 flex-1 flex-col items-center gap-1">
          <span className="text-[11px] font-extrabold text-foreground/70">{d.count}</span>
          <div className="flex h-24 w-full items-end">
            <div
              className={`w-full rounded-t-md ${color}`}
              style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-[10px] text-foreground/40">
            {d.date.slice(5).replace("-", "/")}
          </span>
        </div>
      ))}
    </div>
  );
}
