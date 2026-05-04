"use client";

import { useEffect, useState } from "react";

type Props = {
  basePath: string;
  count: number;
  fps?: number;
  // First numeric index in the file name (e.g. 45 for `step1_0045.png`).
  // Defaults to 0 for sequences that start at `_0000`.
  start?: number;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function FrameSequence({
  basePath,
  count,
  fps = 24,
  start = 0,
  alt,
  className,
  style,
}: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      const img = new window.Image();
      const idx = String(start + i).padStart(4, "0");
      img.src = encodeURI(`${basePath}${idx}.png`);
    }
  }, [basePath, count, start]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % count);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [count, fps]);

  const idx = String(start + frame).padStart(4, "0");
  const src = encodeURI(`${basePath}${idx}.png`);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={style} />;
}
