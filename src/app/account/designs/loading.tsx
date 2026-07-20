import { PortalPageSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PortalPageSkeleton>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-dream-line bg-dream-surface p-4">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </PortalPageSkeleton>
  );
}
