"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen takeover shown from the moment the customer submits their cart
 * until the public order page renders. The cart used to flash its empty state
 * and then blip into /o/{token}; this keeps one calm, branded screen up for
 * the whole server round trip + navigation.
 *
 * The dog is the skateboard delivery animation the tracker uses for the
 * "shipped" stage: an animated .webp that loops on its own, so it is shown
 * big and untouched. No extra decoration, the image does the talking.
 *
 * The messages step forward and stop on the last one (looping back to the
 * first reads as "it started over / something is stuck").
 */
const STEPS = [
  "Packing up your design",
  "Sending it to the print shop",
  "Getting your order number",
];

export function OrderPlacingOverlay({ plural }: { plural: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-overlay-in fixed inset-0 z-[80] flex flex-col items-center justify-center bg-dream-bg px-6 pb-24 text-center sm:pb-32"
    >
      {/* Animated webp already loops on its own, no CSS keyframe needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/delivery-status-dog.webp"
        alt=""
        className="h-72 w-auto object-contain sm:h-96"
      />

      {/* Negative margin eats the empty canvas the webp carries under the
          skateboard, so the copy hugs the dog instead of floating below it. */}
      <h2 className="-mt-6 font-display text-2xl font-extrabold text-dream-ink sm:-mt-10 sm:text-3xl">
        Placing your {plural ? "orders" : "order"}
      </h2>
      <p className="mt-2 min-h-5 text-sm font-medium text-dream-muted">{STEPS[step]}</p>

      {/* Fills like real progress and parks near the end; the order page
          taking over is the "complete". */}
      <div
        aria-hidden="true"
        className="mt-6 h-2 w-56 overflow-hidden rounded-full bg-dream-lavender/40 sm:w-64"
      >
        <div className="animate-loading-fill h-full rounded-full bg-dream-purple" />
      </div>
    </div>
  );
}
