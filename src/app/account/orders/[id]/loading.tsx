import { PortalPageSkeleton, Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PortalPageSkeleton>
      {/* Tracker strip */}
      <div className="rounded-xl border border-dream-line bg-dream-surface p-5">
        <div className="flex items-center justify-between gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-4 h-3 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
      </div>
    </PortalPageSkeleton>
  );
}
