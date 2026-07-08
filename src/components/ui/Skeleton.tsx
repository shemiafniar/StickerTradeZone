import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-black/[0.06]", className)} />;
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("card-shadow rounded-2xl border border-black/5 bg-white p-5", className)}>
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  );
}
