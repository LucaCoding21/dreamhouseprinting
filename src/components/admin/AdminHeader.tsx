/** Sticky top header for admin pages, title + optional actions slot. */
export function AdminHeader({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dream-line bg-dream-surface/80 px-4 py-4 backdrop-blur sm:px-8">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words font-display text-xl font-bold text-dream-ink">{title}</h1>
        {badge}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}
