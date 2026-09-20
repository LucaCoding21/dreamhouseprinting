"use client";

import { useEffect, useRef, useState } from "react";

// A self-hosted behind-the-scenes clip played as a silent, autoplaying,
// looping portrait reel. Plain <video> = NO player controls at all.
//
// Kept fast: the poster shows immediately and the actual video only starts
// loading once the card scrolls near the viewport (IntersectionObserver), so
// it never blocks the initial page load.

export default function ShopReel({
  src,
  poster,
  label,
  className = "",
}: {
  src: string;
  poster: string;
  label: string;
  /** Sizing/snap classes from the parent (e.g. widths in a mobile scroller). */
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className={`rounded-2xl bg-white p-2 shadow-[6px_6px_0_0_rgba(27,20,88,1)] ${className}`}>
      <div className="relative aspect-[5/7] w-full overflow-hidden rounded-xl bg-dream-ink">
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full object-cover"
          src={inView ? src : undefined}
          poster={poster}
          muted
          loop
          autoPlay
          playsInline
          preload="none"
          aria-label={label}
          onCanPlay={(e) => {
            // Setting src lazily can suppress the autoplay attribute, so kick
            // playback off explicitly once the video is ready.
            const v = e.currentTarget;
            if (v.paused) v.play().catch(() => {});
          }}
        />
      </div>
    </figure>
  );
}
