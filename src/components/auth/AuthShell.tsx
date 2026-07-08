import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-brand/5 to-white px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-foreground/60">{subtitle}</p>
        </div>
        <Card>{children}</Card>
      </div>
    </div>
  );
}
