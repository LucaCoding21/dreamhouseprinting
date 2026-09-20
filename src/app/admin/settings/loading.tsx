import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton title="Settings">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <SkeletonCard lines={6} />
      <SkeletonCard lines={4} />
    </AdminPageSkeleton>
  );
}
