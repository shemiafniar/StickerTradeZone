import type { DuplicateWithNumber } from "@/lib/data/collection";
import { DuplicateChip } from "@/components/stickers/DuplicateChip";

export function DuplicateList({ items }: { items: DuplicateWithNumber[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-foreground/50">
        עדיין לא סימנת מדבקות כפולות. הוסיפו כמה מהטופס למעלה, או נסו את{" "}
        <a href="/dashboard/scanner" className="font-bold text-brand-dark underline">
          סורק ה-AI
        </a>{" "}
        לזיהוי אוטומטי!
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <DuplicateChip key={item.id} item={item} />
      ))}
    </div>
  );
}
