"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  label?: string;
  tilt: number;
  className?: string;
  bg?: string;
  padding?: string;
  delay?: number;
};

export default function PolaroidPhoto({
  src,
  label,
  tilt,
  className = "",
  bg = "bg-white",
  padding = "p-3",
  delay = 0,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure
      ref={ref}
      className={`polaroid-pop ${visible ? "is-visible" : ""} ${bg} ${className} ${padding} rounded-[14px] shadow-[8px_8px_0_0_rgba(27,20,88,0.9)] ring-1 ring-dream-ink/10`}
      style={{ rotate: `${tilt}deg`, animationDelay: `${delay}ms` }}
    >
      <div className="aspect-square w-full overflow-hidden rounded-[8px] bg-dream-lavender-soft">
        <Image
          src={src}
          alt=""
          width={520}
          height={520}
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      </div>
      {label ? (
        <figcaption className="mt-2 px-1 pb-1 text-center font-display text-[12px] font-bold uppercase tracking-[0.16em] text-dream-ink/70">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}
