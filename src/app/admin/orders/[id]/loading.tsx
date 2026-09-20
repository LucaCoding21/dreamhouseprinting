import { Skeleton, SkeletonCard, SkeletonRows } from "@/components/ui/Skeleton";

/** Mirrors OrderDetailClient's single-column stack (command header card,
 *  items, history, reference grid) so there's no layout jump on load. */
export default function Loading() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-8">
      {/* Command header card */}
      <div className="rounded-xl border border-dream-line bg-dream-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>
      <SkeletonCard lines={4} />
      <SkeletonRows rows={3} />
      <SkeletonCard lines={3} />
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}
