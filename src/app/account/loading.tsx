import { PortalPageSkeleton, Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PortalPageSkeleton>
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </PortalPageSkeleton>
  );
}
