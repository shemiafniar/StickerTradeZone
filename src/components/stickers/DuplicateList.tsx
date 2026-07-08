import type { DuplicateWithNumber } from "@/lib/data/collection";
import { removeDuplicateAction, toggleForSaleAction } from "@/lib/actions/stickers";

export function DuplicateList({ items }: { items: DuplicateWithNumber[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-foreground/50">
        עדיין לא סימנת מדבקות כפולות. הוסיפו כמה מהטופס למעלה!
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
          <span className="rounded-lg bg-brand/10 px-2 py-1 text-brand-dark">#{item.number}</span>
          {item.for_sale && (
            <span className="rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-bold text-orange-700">
              למכירה
            </span>
          )}
          <form action={toggleForSaleAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="forSale" value={String(item.for_sale)} />
            <button
              type="submit"
              className="rounded-lg px-1.5 py-1 text-xs text-foreground/50 hover:bg-black/5"
              title={item.for_sale ? "הסר ממכירה" : "סמן למכירה"}
            >
              {item.for_sale ? "💰" : "🏷️"}
            </button>
          </form>
          <form action={removeDuplicateAction}>
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
