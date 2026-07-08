import { cn } from "@/lib/cn";

const ITEMS: { color: string; label: string }[] = [
  { color: "bg-black/10", label: "לא מסומן" },
  { color: "bg-green-500", label: "יש לי" },
  { color: "bg-blue-500", label: "כפול/להחלפה" },
  { color: "bg-red-500", label: "חסר לי" },
];

export function ColorLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-foreground/70", className)}>
      {ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn("h-3.5 w-3.5 shrink-0 rounded-full", item.color)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
