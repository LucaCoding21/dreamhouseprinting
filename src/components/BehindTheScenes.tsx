import Image from "next/image";
import ShopReel from "@/components/ShopReel";

// Homepage "Behind the scenes", mirrors the layout on /about (heading + copy
// top-left, three video reels bottom-right). Reuses the same three shop clips
// from /public/behind-the-scenes.

export default function BehindTheScenes() {
  return (
    <section className="relative overflow-hidden bg-dream-lavender-soft pb-24 pt-24 lg:pb-32 lg:pt-32">
      {/* Top-edge scallops rising into this section from the one above */}
      <svg
        aria-hidden="true"
        preserveAspectRatio="xMidYMid"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[28px] w-full"
      >
        <defs>
          <pattern
            id="home-bts-scallop"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="0" rx="60" ry="28" fill="#f4f2ff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#home-bts-scallop)" />
      </svg>

      {/* Decorative sticker, fills the empty top-right corner */}
      <Image
        src="/madeinvan/sticker1.png"
        alt=""
        width={400}
        height={400}
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-12 z-0 hidden h-auto w-[130px] rotate-[12deg] sm:block lg:right-14 lg:w-[170px]"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-8 lg:px-10">
        {/* TOP-LEFT, heading + copy */}
        <div className="max-w-[560px] text-left">
          <h2 className="font-display text-[38px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[56px]">
            Behind the{" "}
            <span className="relative inline-block">
              scenes
              <ScribbleUnderline className="-bottom-1" />
            </span>
            .
          </h2>
          <p className="mt-7 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            Ever wondered how a blank shirt turns into the real thing? Here&apos;s
            a look inside the shop, from burning screens to the press pulling
            ink, so you can see exactly where your order gets made.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-dream-ink-soft sm:text-[16px]">
            Every order runs through these same hands and machines. No
            middleman, no guesswork, just real people making your stuff right
            here in the shop.
          </p>
        </div>

        {/* BOTTOM-RIGHT, video reels */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-7 lg:mt-16 lg:ml-auto lg:w-[80%] lg:gap-8">
          <ShopReel
            src="/behind-the-scenes/screen-printing-press-vancouver.mp4"
            poster="/behind-the-scenes/screen-printing-press-vancouver.jpg"
            label="Pulling ink across the screen at our Vancouver shop"
          />
          <ShopReel
            src="/behind-the-scenes/screen-printing-workbench-vancouver.mp4"
            poster="/behind-the-scenes/screen-printing-workbench-vancouver.jpg"
            label="Prepping a screen print job at our Vancouver shop"
          />
          <ShopReel
            src="/behind-the-scenes/screen-printing-station-vancouver.mp4"
            poster="/behind-the-scenes/screen-printing-station-vancouver.jpg"
            label="Working a print at our Vancouver studio"
          />
        </div>
      </div>
    </section>
  );
}

function ScribbleUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 12"
      preserveAspectRatio="none"
      className={`absolute left-0 right-0 h-[12px] w-full ${className}`}
    >
      <path
        d="M4 7 C 20 3, 40 9, 60 6 S 100 3, 120 7 S 160 4, 184 7 S 210 8, 216 6"
        stroke="#ecbb25"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
