import { AdminHeader } from "@/components/admin/AdminHeader";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

/**
 * Standard admin route shell for loading.tsx files: the real sticky header
 * (instant, correct title) over skeleton content, so navigation paints
 * immediately while the server render streams in.
 */
export function AdminPageSkeleton({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <AdminHeader title={title} />
      <div className="space-y-6 px-4 py-6 sm:px-8">
        {children ?? (
          <>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            <SkeletonRows />
          </>
        )}
      </div>
    </div>
  );
}
