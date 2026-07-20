import { Skeleton, SkeletonCard, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-dream-line bg-dream-surface/80 px-8 py-4 backdrop-blur">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="space-y-6 px-8 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
        <SkeletonRows rows={5} />
      </div>
    </div>
  );
}
