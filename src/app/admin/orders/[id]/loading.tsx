import { Skeleton, SkeletonCard, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      {/* Command header strip */}
      <div className="sticky top-0 z-10 border-b border-dream-line bg-dream-surface/80 px-8 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 px-8 py-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <SkeletonCard lines={2} />
          <div className="grid gap-4 md:grid-cols-3">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
          <SkeletonRows rows={3} />
          <SkeletonCard lines={4} />
        </div>
        <div className="space-y-4">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
      </div>
    </div>
  );
}
