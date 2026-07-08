import type { MissingWithNumber } from "@/lib/data/collection";
import { removeMissingAction, moveMissingToHaveAction } from "@/lib/actions/stickers";

export function MissingList({ items }: { items: MissingWithNumber[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-foreground/50">
        אין לך מדבקות חסרות רשומות. מעולה, או שכדאי לעדכן את הרשימה!
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white py-1.5 pr-1.5 pl-3 text-sm font-bold shadow-sm"
        >
          <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">#{item.number}</span>
          <form action={moveMissingToHaveAction}>
            <input type="hidden" name="missingId" value={item.id} />
            <input type="hidden" name="stickerId" value={item.sticker_id} />
            <button
              type="submit"
              className="rounded-lg px-1.5 py-1 text-xs text-foreground/50 hover:bg-black/5"
              title="סמן שכבר יש לי"
            >
              ✅
            </button>
          </form>
          <form action={removeMissingAction}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="rounded-lg px-1.5 py-1 text-xs text-red-500 hover:bg-red-50"
              title="הסר"
            >
              ✕
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
