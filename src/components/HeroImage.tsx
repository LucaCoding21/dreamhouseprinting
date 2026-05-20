"use client";

import Image from "next/image";
import { useState } from "react";

// Hero photo with a pop-in once the image bytes finish downloading. Hidden
// (opacity 0) before load so we don't get the "image suddenly snaps in"
// glitch; once `onLoad` fires, .animate-pop runs the existing bouncy
// scale-from-0 keyframe defined in globals.css.
export default function HeroImage() {
  const [loaded, setLoaded] = useState(false);
  return (
    // Wrapper carries the lg upscale so anything absolutely positioned inside
    // (the stickers) scales and stays anchored to the visual image edges.
    // transform-origin matches the previous image transform so the layout
    // grows downward from the top edge.
    <div
      className="relative lg:scale-[1.35]"
      style={{ transformOrigin: "center top" }}
    >
      <Image
        src="/sticker3.png"
        alt=""
        aria-hidden="true"
        width={400}
        height={400}
        className="pointer-events-none absolute left-4 top-4 z-20 h-auto w-[90px] -rotate-12 sm:left-6 sm:top-8 sm:w-[120px] lg:left-6 lg:top-10 lg:w-[110px]"
      />
      <Image
        src="/sticker2.png"
        alt=""
        aria-hidden="true"
        width={400}
        height={400}
        className="pointer-events-none absolute right-2 bottom-2 z-20 h-auto w-[100px] rotate-[10deg] sm:right-0 sm:bottom-4 sm:w-[130px] lg:right-2 lg:bottom-6 lg:w-[130px]"
      />
      <Image
        src="/homepage_assets/dreamhouse-hero.webp"
        alt="Custom printed apparel: sweatshirt, tote bag, hat, and t-shirt on a hand-drawn purple background"
        title="Custom apparel and screen printing in Vancouver"
        width={1600}
        height={1468}
        priority
        onLoad={() => setLoaded(true)}
        sizes="(min-width: 1024px) 820px, (min-width: 768px) 55vw, 100vw"
        className={`relative z-10 h-auto w-full max-h-[760px] object-contain sm:max-h-[780px] md:max-h-[820px] lg:max-h-[990px] ${
          loaded ? "animate-pop" : "opacity-0"
        }`}
      />
    </div>
  );
}
