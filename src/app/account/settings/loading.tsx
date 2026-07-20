import { PortalPageSkeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PortalPageSkeleton>
      <SkeletonCard lines={6} />
    </PortalPageSkeleton>
  );
}
