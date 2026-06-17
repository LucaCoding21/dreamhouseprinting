/** Skeleton shown while the shop catalog loads (server fetch in flight). */
export default function ShopLoading() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-7 space-y-2">
        <div className="h-9 w-56 rounded-lg bg-dream-line" />
        <div className="h-4 w-80 rounded bg-dream-line/70" />
      </div>

      {/* Category tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-dream-lavender-soft/70" />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="hidden lg:block lg:w-60 lg:shrink-0">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-full rounded-lg bg-dream-line/70" />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-dream-line bg-white">
                <div className="aspect-square w-full bg-dream-cream" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-16 rounded bg-dream-line/70" />
                  <div className="h-4 w-3/4 rounded bg-dream-line" />
                  <div className="h-6 w-20 rounded-full bg-dream-line/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
