import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton title="Dashboard">
      <Skeleton className="h-4 w-72" />
      <div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </AdminPageSkeleton>
  );
}
