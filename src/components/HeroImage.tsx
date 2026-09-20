"use client";

import Image from "next/image";
import { useState } from "react";
// Static import so width/height come from the file itself (the box is
// reserved before any bytes arrive, so a cold load can't shift the copy).
import heroPhoto from "../../public/homepage_assets/custom-apparel-vancouver.webp";

// Hero photo with a pop-in once the image bytes finish downloading. Hidden
// (opacity 0) before load so we don't get the "image suddenly snaps in"
// glitch; once `onLoad` fires, .animate-pop runs the existing bouncy
// scale-from-0 keyframe defined in globals.css, and the blur fades out under it.
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
        src="/sticker2.png"
        alt=""
        aria-hidden="true"
        width={400}
        height={400}
        className="pointer-events-none absolute right-2 bottom-2 z-20 h-auto w-[100px] rotate-[10deg] sm:right-0 sm:bottom-4 sm:w-[130px] lg:right-2 lg:bottom-6 lg:w-[130px]"
      />
      {/* Flat lavender stand-in roughly tracing the photo's purple blob, sized
          by the real image below (the only in-flow child, so the wrapper is
          exactly the photo's box). A blurred copy of the photo was tried first
          and its edges bled into a purple haze that read as a drop shadow. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[7%_3%_5%_3%] rounded-[48%_52%_45%_55%/55%_45%_55%_45%] bg-dream-lavender-soft transition-opacity duration-500 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />
      <Image
        src={heroPhoto}
        alt="Custom printed apparel: sweatshirt, tote bag, hat, and t-shirt on a hand-drawn purple background"
        title="Custom apparel and screen printing in Vancouver"
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
