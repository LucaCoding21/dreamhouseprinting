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
      sizes="(min-width: 1024px) 700px, (min-width: 768px) 50vw, 100vw"
      className={`h-auto w-full max-h-[760px] object-contain sm:max-h-[780px] md:max-h-[700px] lg:max-h-[740px] ${
        loaded ? "animate-pop" : "opacity-0"
      }`}
    />
  );
}
