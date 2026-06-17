/** Sticky top header for admin pages — title + optional actions slot. */
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
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-dream-line bg-dream-surface/80 px-8 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-xl font-bold text-dream-ink">{title}</h1>
        {badge}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
