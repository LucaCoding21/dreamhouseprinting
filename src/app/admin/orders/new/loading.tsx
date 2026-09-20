import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton title="New order">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={8} />
        </div>
        <SkeletonCard lines={8} />
      </div>
    </AdminPageSkeleton>
  );
}
