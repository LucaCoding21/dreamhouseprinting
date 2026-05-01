"use client";

import { useEffect, useState } from "react";

type Props = {
  basePath: string;
  count: number;
  fps?: number;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function FrameSequence({
  basePath,
  count,
  fps = 24,
  alt,
  className,
  style,
}: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      const img = new window.Image();
      const idx = String(i).padStart(4, "0");
      img.src = encodeURI(`${basePath}${idx}.png`);
    }
  }, [basePath, count]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % count);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [count, fps]);

  const idx = String(frame).padStart(4, "0");
  const src = encodeURI(`${basePath}${idx}.png`);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={style} />;
}
