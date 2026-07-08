import { cn } from "@/lib/cn";
import type { TradeStatus } from "@/types/database";

const statusConfig: Record<TradeStatus, { label: string; className: string }> = {
  pending: { label: "ממתין לתשובה", className: "bg-amber-100 text-amber-800" },
  accepted: { label: "אושר", className: "bg-green-100 text-green-800" },
  declined: { label: "נדחה", className: "bg-red-100 text-red-700" },
  completed: { label: "הושלם", className: "bg-blue-100 text-blue-800" },
  cancelled: { label: "בוטל", className: "bg-gray-100 text-gray-600" },
};

export function TradeStatusBadge({ status }: { status: TradeStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-bold", config.className)}>
      {config.label}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-block rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-foreground/70", className)}>
      {children}
    </span>
  );
}
