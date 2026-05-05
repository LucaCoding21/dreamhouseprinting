"use client";

import type { CSSProperties, ReactNode } from "react";
import { useReveal } from "@/hooks/useReveal";

type Variant = "pop" | "up" | "stamp";

export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
  style,
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { ref, revealed } = useReveal();
  const mergedStyle: CSSProperties | undefined =
    delay || style
      ? { ...(style ?? {}), ...(delay ? { animationDelay: `${delay}ms` } : null) }
      : undefined;
  return (
    <div
      ref={ref}
      style={mergedStyle}
      className={`reveal-${variant} ${revealed ? "revealed" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
