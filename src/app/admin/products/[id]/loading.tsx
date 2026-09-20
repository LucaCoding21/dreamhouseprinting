import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-dream-line bg-dream-surface/80 px-8 py-4 backdrop-blur">
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="grid gap-6 px-4 py-6 sm:px-8 lg:grid-cols-2">
        <div className="space-y-4">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={4} />
        </div>
        <div className="space-y-4">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  );
}
