import { Skeleton } from "@/components/ui/Skeleton";

export default function StickersLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-56" />
      <Skeleton className="mb-5 h-11 w-full max-w-sm" />
      <div className="card-shadow rounded-2xl border border-black/5 bg-white p-5">
        <Skeleton className="mb-3 h-5 w-48" />
        <Skeleton className="mb-4 h-20 w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20" />
          ))}
        </div>
      </div>
    </div>
  );
}
