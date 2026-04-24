import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import ScribbleButton from "./ScribbleButton";

const NAV_LINKS = [
  { label: "Services", href: "/services", rotate: -1 },
  { label: "About", href: "/about", rotate: 1 },
  { label: "Contact", href: "/contact", rotate: -0.5 },
];

// 12 rays on an ellipse around the Quick Quote pill.
// Each ray gets small length/angle jitter so they feel hand-drawn, not CAD.
const SUN_RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = i * 30;
  const rad = (angle * Math.PI) / 180;
  const rx = 100;
  const ry = 54;
  // Pseudo-random but stable per-index offsets.
  const lenJitter = [18, 14, 17, 15, 19, 13, 17, 15, 18, 14, 16, 15][i];
  const angleJitter = [-3, 4, -2, 5, -4, 2, -3, 4, -5, 3, -2, 4][i];
  return {
    x: +(Math.cos(rad) * rx).toFixed(1),
    y: +(Math.sin(rad) * ry).toFixed(1),
    r: angle + angleJitter,
    len: lenJitter,
    delay: +(((i * 83) % 450) / 1000).toFixed(2),
  };
});

export default function SiteNav() {
  return (
    <header className="w-full px-5 py-7 lg:px-10 lg:py-9">
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
        <defs>
          <filter
            id="scribble-morph"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.03"
              numOctaves="2"
              seed="1"
              result="noise"
            >
              <animate
                attributeName="seed"
                values="1;3;5;7;9;11"
                dur="0.75s"
                repeatCount="indefinite"
                calcMode="discrete"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" />
          </filter>
        </defs>
      </svg>

      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/homepage_assets/Dreamhouse logo.png"
            alt="Dreamhouse Printing"
            width={140}
            height={140}
            priority
            className="h-14 w-14 lg:h-16 lg:w-16"
          />
          <span className="font-display text-[22px] font-extrabold leading-[1.05] text-dream-scribble lg:text-[26px]">
            Dreamhouse
            <br />
            Printing
          </span>
        </Link>

        <div className="flex items-center gap-10">
          <nav className="hidden items-center gap-3 xl:flex">
            {NAV_LINKS.map((link) => (
              <ScribbleButton
                key={link.href}
                href={link.href}
                rotate={link.rotate}
              >
                {link.label}
              </ScribbleButton>
            ))}
          </nav>

          <div className="sun-burst relative inline-block">
          {SUN_RAYS.map((ray, i) => (
            <span
              key={i}
              aria-hidden
              className="sun-ray"
              style={
                {
                  "--x": `${ray.x}px`,
                  "--y": `${ray.y}px`,
                  "--r": `${ray.r}deg`,
                  "--delay": `${ray.delay}s`,
                  width: `${ray.len}px`,
                } as CSSProperties
              }
            />
          ))}
          <Link
            href="/quote"
            className="rough-pill rough-pill-filled relative inline-flex items-center justify-center px-8 py-3.5 font-display text-[17px] font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Quick Quote
          </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
