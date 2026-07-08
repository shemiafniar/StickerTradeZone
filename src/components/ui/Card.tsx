import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("card-shadow rounded-2xl border border-black/5 bg-white p-5", className)}>
      {children}
    </div>
  );
}
