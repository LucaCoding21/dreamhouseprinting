import { PortalPageSkeleton, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PortalPageSkeleton>
      <SkeletonRows rows={6} />
    </PortalPageSkeleton>
  );
}
