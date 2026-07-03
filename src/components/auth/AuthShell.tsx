import Link from "next/link";
import Image from "next/image";

/** Centered, branded frame for the auth pages (login / register) — a playful
 *  sky with a layered cloud horizon along the bottom and a chunky raised card. */
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
    <main className="relative isolate h-dvh overflow-hidden bg-gradient-to-b from-dream-lavender-mist via-dream-cream to-dream-lavender-soft flex flex-col items-center justify-center px-4 pt-12 pb-56">
      {/* --- Layered cloud horizon (behind everything, non-interactive).
          Stacking order follows the file names: back < mid < front. --- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 select-none">
        <Image
          src="/cloud-back.svg"
          alt=""
          aria-hidden="true"
          width={3899}
          height={1892}
          priority
          className="absolute bottom-0 left-1/2 z-0 w-[90%] max-w-none -translate-x-1/2 translate-y-[24%] -rotate-6 opacity-80"
        />
      </div>

      {/* --- Mid + front clouds, lifted ABOVE the login card (click-through).
          Front stays on top: mid z-30 < front z-40. --- */}
      <Image
        src="/cloud-mid.svg"
        alt=""
        aria-hidden="true"
        width={2860}
        height={1550}
        priority
        className="pointer-events-none absolute bottom-0 left-0 z-30 w-[75%] max-w-none -translate-x-[20%] translate-y-[38%] select-none opacity-100"
      />
      <Image
        src="/front-cloud.svg"
        alt=""
        aria-hidden="true"
        width={3723}
        height={2092}
        priority
        className="pointer-events-none absolute bottom-0 right-0 z-40 w-[75%] max-w-none translate-x-[30%] translate-y-[33%] select-none"
      />

      {/* --- Brand mark --- */}
      <Link href="/" className="mb-8 flex items-center">
        <Image
          src="/dreamhouse-logo-nav.svg"
          alt="Dreamhouse Printing"
          width={457}
          height={298}
          priority
          className="h-24 w-auto"
        />
      </Link>

      {/* --- The card --- */}
      <div className="relative w-full max-w-md">
        {/* peeking sun-yellow sparkle sticker */}
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="absolute -right-4 -top-5 z-10 h-14 w-14 rotate-12 drop-shadow-sm"
        >
          <path
            d="M50 6 C56 34 66 44 94 50 C66 56 56 66 50 94 C44 66 34 56 6 50 C34 44 44 34 50 6 Z"
            fill="#ecbb25"
            stroke="#1b1458"
            strokeWidth={4}
            strokeLinejoin="round"
          />
        </svg>

        <div className="relative rounded-[28px] border-[3px] border-dream-ink bg-dream-surface p-8 shadow-[0_8px_0_0_rgba(27,20,88,0.9)]">
          <h1 className="font-display text-3xl font-bold text-dream-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-dream-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>

      {footer && <div className="relative mt-6 text-sm text-dream-muted">{footer}</div>}
    </main>
  );
}
