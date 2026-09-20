import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton title="Pricing">
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </AdminPageSkeleton>
  );
}
