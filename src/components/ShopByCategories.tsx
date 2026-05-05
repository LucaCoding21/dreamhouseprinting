import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

type Category = {
  label: string;
  href: string;
  image: string;
  imageWidth: string;
  startingAt: string;
  tagTilt: number;
  photo?: boolean;
  photoScale?: number;
};

const CATEGORIES: Category[] = [
  {
    label: "Shirts",
    href: "/quote?product=shirt",
    image: "/shopbycategories/shirt-categories.jpg",
    imageWidth: "100%",
    startingAt: "$12",
    tagTilt: -6,
    photo: true,
  },
  {
    label: "Hoodies",
    href: "/quote?product=hoodie",
    image: "/shopbycategories/hoodie-cat.jpeg",
    imageWidth: "100%",
    startingAt: "$32",
    tagTilt: 5,
    photo: true,
  },
  {
    label: "Hats",
    href: "/quote?product=hat",
    image: "/shopbycategories/hat-categories.jpg",
    imageWidth: "100%",
    startingAt: "$18",
    tagTilt: -4,
    photo: true,
  },
  {
    label: "Bags",
    href: "/quote?product=bag",
    image: "/shopbycategories/bag-cat.jpeg",
    imageWidth: "100%",
    startingAt: "$14",
    tagTilt: 6,
    photo: true,
    photoScale: 1.15,
  },
];

export default function ShopByCategories() {
  return (
    <section className="relative bg-white">
      <svg
        className="pointer-events-none absolute -top-[28px] left-0 z-10 block h-[28px] w-full"
        preserveAspectRatio="xMidYMid"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="sbc-scallop-top"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="28" rx="60" ry="28" fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sbc-scallop-top)" />
      </svg>

      <svg
        className="pointer-events-none absolute -bottom-[28px] left-0 z-10 block h-[28px] w-full"
        preserveAspectRatio="xMidYMid"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="sbc-scallop-bottom"
            width="120"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <ellipse cx="60" cy="0" rx="60" ry="28" fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sbc-scallop-bottom)" />
      </svg>

      <div className="mx-auto max-w-[1620px] px-6 pt-28 pb-32 lg:px-12 lg:pt-32 lg:pb-36">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          <h2 className="font-display text-3xl font-bold leading-tight text-dream-ink sm:text-4xl">
            What we print
          </h2>
          <p className="max-w-xl text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
            Quality apparel and accessories for teams, brands, and businesses. Pick a category to start your custom order.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2 lg:grid-cols-4 lg:gap-2">
            {CATEGORIES.map((cat) => (
          <Link
            key={cat.label}
            href={cat.href}
            className="group rough-card relative flex flex-col items-center gap-3 px-1 py-2 transition-transform duration-200 hover:-translate-y-1 sm:gap-4 sm:px-1 sm:py-2"
          >
            <span
              aria-hidden="true"
              className="price-tag-alive pointer-events-none absolute -top-4 right-3 z-20 inline-flex items-baseline gap-1.5 rounded-full bg-dream-purple px-5 py-2.5 font-display text-white shadow-[0_4px_0_0_rgba(27,20,88,0.5)] ring-2 ring-white"
              style={{ "--base-tilt": `${cat.tagTilt}deg` } as CSSProperties}
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
                from
              </span>
              <span className="font-display text-xl font-bold leading-none">
                {cat.startingAt}
              </span>
            </span>

            <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden">
              <Image
                src={cat.image}
                alt={`${cat.label} illustration`}
                width={400}
                height={400}
                className={
                  cat.photo
                    ? "absolute inset-0 z-10 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                    : "relative z-10 h-auto transition-transform duration-300 ease-out group-hover:scale-105"
                }
                style={
                  cat.photo
                    ? cat.photoScale
                      ? { transform: `scale(${cat.photoScale})` }
                      : undefined
                    : { width: cat.imageWidth }
                }
              />
            </div>

            <div className="flex w-full flex-col items-center">
              <div className="relative inline-flex flex-col items-center">
                <span className="font-display text-lg font-bold text-dream-ink sm:text-xl">
                  {cat.label}
                </span>
                <div className="relative mt-1 h-[6px] w-14">
                  {[
                    "M1 4 C 10 1, 20 5, 30 3 S 50 1, 59 4",
                    "M1 3 C 12 5, 22 1, 32 4 S 48 2, 59 3",
                    "M1 4 C 9 2, 22 4, 30 2 S 52 5, 59 4",
                  ].map((d, i) => (
                    <svg
                      key={i}
                      className={`scribble-frame scribble-frame-${i + 1} absolute inset-0 h-full w-full`}
                      viewBox="0 0 60 6"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d={d}
                        stroke="#ecbb25"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
        </div>
      </div>
    </section>
  );
}
