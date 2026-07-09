import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  /** Subtle hover lift + deeper shadow, for cards that are themselves a link/button (e.g. a clickable summary tile). */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "card-shadow rounded-2xl border border-black/5 bg-white p-5",
        interactive && "transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-brand/20",
        className
      )}
    >
      {children}
    </div>
  );
}
