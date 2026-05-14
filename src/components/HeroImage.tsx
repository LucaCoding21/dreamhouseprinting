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
    <Image
      src="/homepage_assets/hero_photo.webp"
      alt="Custom printed apparel: sweatshirt, tote bag, hat, and t-shirt on a hand-drawn purple background"
      width={1600}
      height={1607}
      priority
      onLoad={() => setLoaded(true)}
      sizes="(min-width: 1024px) 820px, (min-width: 768px) 55vw, 100vw"
      // transform-origin: center top so the pop-bounce scale grows the image
      // downward from its top edge. With the default `center center`, the
      // 1.2× overshoot at 55% briefly pushed the top above its normal
      // position and got clipped (most visible in laptop mobile emulation).
      style={{ transformOrigin: "center top" }}
      className={`h-auto w-full max-h-[760px] object-contain sm:max-h-[780px] md:max-h-[820px] lg:max-h-[880px] ${
        loaded ? "animate-pop" : "opacity-0"
      }`}
    />
  );
}
