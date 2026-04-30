"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Eye positions detected from /how it works/step3.apng (500x308 source).
// Head is static across all 35 frames; only paws animate.
//   left  eye centroid: (227, 87)  bbox 8w x 11h
//   right eye centroid: (265, 88)  bbox 8w x 11h
// Each eye gets a slightly different smoothing factor so the pair doesn't move
// in lockstep — small asymmetry reads as personality. Low values = slow, dopey
// follow with no overshoot.
const EYES = [
  { xPct: 227 / 500, yPct: 87 / 308, smooth: 0.05 },
  { xPct: 265 / 500, yPct: 88 / 308, smooth: 0.045 },
] as const;

// Sizes as fractions of the 500x308 source.
// Pupil matches the original eye dot (8x11). White cover is just 1.5px larger
// on each side to swallow the AA halo of the underlying black dot — at rest the
// eye reads as a solid black dot the way it does in the original art.
const WHITE_W_PCT = 13 / 500;
const WHITE_H_PCT = 16 / 308;
const PUPIL_W_PCT = 10 / 500;
const PUPIL_H_PCT = 13 / 308;
const MAX_OFFSET_PX = 2.5;

const IDLE_MS = 2000;
const SACCADE_MIN_MS = 2800;
const SACCADE_MAX_MS = 5200;

type Box = { x: number; y: number; w: number; h: number };

export default function HeroDog() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pupilRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [box, setBox] = useState<Box | null>(null);

  // Measure the actual rendered <img> rect within the container. This sidesteps
  // any CSS aspect-ratio / inset trickery — we use the real geometry.
  useEffect(() => {
    const measure = () => {
      const img = imgRef.current;
      const container = containerRef.current;
      if (!img || !container) return;
      const imgR = img.getBoundingClientRect();
      const ctR = container.getBoundingClientRect();
      if (imgR.width === 0 || imgR.height === 0) return;
      setBox({
        x: imgR.left - ctR.left,
        y: imgR.top - ctR.top,
        w: imgR.width,
        h: imgR.height,
      });
    };

    measure();

    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (imgRef.current) ro.observe(imgRef.current);
    window.addEventListener("resize", measure);

    const img = imgRef.current;
    const onLoad = () => measure();
    if (img && !img.complete) img.addEventListener("load", onLoad);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      if (img) img.removeEventListener("load", onLoad);
    };
  }, []);

  // Spring-driven eye tracking + idle saccades.
  useEffect(() => {
    if (!box) return;

    const target = EYES.map(() => ({ x: 0, y: 0 }));
    const current = EYES.map(() => ({ x: 0, y: 0 }));
    let mouseAt = { x: 0, y: 0, t: -Infinity };
    let saccadeOffset = { x: 0, y: 0 };
    let nextSaccade = performance.now() + 1500;
    let raf = 0;

    const recalcTargets = (now: number) => {
      const container = containerRef.current;
      if (!container) return;
      const ctR = container.getBoundingClientRect();
      const idle = now - mouseAt.t > IDLE_MS;
      for (let i = 0; i < EYES.length; i++) {
        const eye = EYES[i];
        if (idle) {
          target[i].x = saccadeOffset.x;
          target[i].y = saccadeOffset.y;
        } else {
          const ecx = ctR.left + box.x + box.w * eye.xPct;
          const ecy = ctR.top + box.y + box.h * eye.yPct;
          const dx = mouseAt.x - ecx;
          const dy = mouseAt.y - ecy;
          const dist = Math.hypot(dx, dy) || 1;
          const len = Math.min(dist, MAX_OFFSET_PX);
          target[i].x = (dx / dist) * len;
          target[i].y = (dy / dist) * len;
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      mouseAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const tick = (now: number) => {
      if (now - mouseAt.t > IDLE_MS && now > nextSaccade) {
        if (Math.random() < 0.3) {
          saccadeOffset = { x: 0, y: 0 };
        } else {
          const angle = Math.random() * Math.PI * 2;
          const r = MAX_OFFSET_PX * (0.35 + Math.random() * 0.65);
          saccadeOffset = { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
        }
        nextSaccade =
          now + SACCADE_MIN_MS + Math.random() * (SACCADE_MAX_MS - SACCADE_MIN_MS);
      }

      recalcTargets(now);

      for (let i = 0; i < EYES.length; i++) {
        const eye = EYES[i];
        current[i].x += (target[i].x - current[i].x) * eye.smooth;
        current[i].y += (target[i].y - current[i].y) * eye.smooth;
        const pupil = pupilRefs.current[i];
        if (pupil) {
          pupil.style.transform = `translate(calc(-50% + ${current[i].x.toFixed(
            2,
          )}px), calc(-50% + ${current[i].y.toFixed(2)}px))`;
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [box]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-square w-full max-w-[380px] lg:max-w-none"
    >
      <Image
        src="/how it works/3blob.svg"
        alt=""
        width={680}
        height={820}
        className="blob-morph absolute inset-0 m-auto h-[88%] w-[88%] object-contain"
        aria-hidden="true"
      />
      <Image
        ref={imgRef}
        src="/how it works/step3.apng"
        alt=""
        width={460}
        height={460}
        unoptimized
        className="absolute inset-0 m-auto h-auto"
        style={{
          width: "180%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden="true"
      />
      {box &&
        EYES.map((eye, i) => (
          <span
            key={`white-${i}`}
            className="pointer-events-none absolute"
            style={{
              left: `${box.x + box.w * eye.xPct}px`,
              top: `${box.y + box.h * eye.yPct}px`,
              width: `${box.w * WHITE_W_PCT}px`,
              height: `${box.h * WHITE_H_PCT}px`,
              transform: "translate(-50%, -50%)",
              background: "#ffffff",
              borderRadius: "50%",
            }}
            aria-hidden="true"
          />
        ))}
      {box &&
        EYES.map((eye, i) => (
          <span
            key={`pupil-${i}`}
            ref={(el) => {
              pupilRefs.current[i] = el;
            }}
            className="pointer-events-none absolute"
            style={{
              left: `${box.x + box.w * eye.xPct}px`,
              top: `${box.y + box.h * eye.yPct}px`,
              width: `${box.w * PUPIL_W_PCT}px`,
              height: `${box.h * PUPIL_H_PCT}px`,
              transform: "translate(-50%, -50%)",
              background: "#000000",
              borderRadius: "50%",
            }}
            aria-hidden="true"
          />
        ))}
    </div>
  );
}
