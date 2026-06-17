import Link from "next/link";
import Image from "next/image";

/** Centered, branded frame for the auth pages (login / register). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-dream-bg flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image src="/dreamhouse-logo.svg" alt="Dreamhouse Printing" width={40} height={40} />
        <span className="font-display text-xl font-bold text-dream-ink">Dreamhouse</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-dream-line bg-dream-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-dream-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-dream-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="mt-6 text-sm text-dream-muted">{footer}</div>}
    </main>
  );
}
