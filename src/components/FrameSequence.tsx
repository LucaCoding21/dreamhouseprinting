"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  basePath: string;
  count: number;
  fps?: number;
  // First numeric index in the file name (e.g. 45 for `step1_0045.png`).
  // Defaults to 0 for sequences that start at `_0000`.
  start?: number;
  // Absolute frame numbers to skip (e.g. [7, 15, 23] when those files are missing).
  skip?: number[];
  alt: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function FrameSequence({
  basePath,
  count,
  fps = 24,
  start = 0,
  skip,
  alt,
  className,
  style,
}: Props) {
  const frames = useMemo(() => {
    const skipSet = new Set(skip ?? []);
    const arr: number[] = [];
    for (let i = 0; i < count; i++) {
      const n = start + i;
      if (!skipSet.has(n)) arr.push(n);
    }
    return arr;
  }, [count, start, skip]);

  const [frame, setFrame] = useState(0);

  useEffect(() => {
    for (const n of frames) {
      const img = new window.Image();
      const idx = String(n).padStart(4, "0");
      img.src = encodeURI(`${basePath}${idx}.png`);
    }
  }, [basePath, frames]);

  useEffect(() => {
    if (frames.length === 0) return;
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [frames, fps]);

  const idx = String(frames[frame] ?? start).padStart(4, "0");
  const src = encodeURI(`${basePath}${idx}.png`);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={style} />;
}
