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
};

const CATEGORIES: Category[] = [
  {
    label: "Shirts",
    href: "/quote?product=shirt",
    image: "/shopbycategories/shirtcategory.webp",
    imageWidth: "115%",
    startingAt: "$12",
    tagTilt: -6,
  },
  {
    label: "Hoodies",
    href: "/quote?product=hoodie",
    image: "/shopbycategories/hoodiecategory.webp",
    imageWidth: "115%",
    startingAt: "$32",
    tagTilt: 5,
  },
  {
    label: "Hats",
    href: "/quote?product=hat",
    image: "/shopbycategories/hatcategory.webp",
    imageWidth: "120%",
    startingAt: "$18",
    tagTilt: -4,
  },
  {
    label: "Bags",
    href: "/quote?product=bag",
    image: "/shopbycategories/bagscategory.webp",
    imageWidth: "108%",
    startingAt: "$14",
    tagTilt: 6,
  },
];

export default function ShopByCategories() {
  return (
    <section className="mx-auto max-w-[1550px] px-6 pt-10 pb-20 lg:px-10 lg:pt-14 lg:pb-28">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl font-bold text-dream-ink sm:text-3xl">
          Shop by categories
        </h2>
        <Link
          href="/services"
          className="font-display text-sm font-semibold text-dream-purple underline-offset-4 hover:underline sm:text-base"
        >
          Browse services
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.label}
            href={cat.href}
            className="group rough-card relative flex flex-col items-center gap-3 px-4 py-5 transition-transform duration-200 hover:-translate-y-1 sm:gap-4 sm:px-5 sm:py-6"
          >
            <span
              aria-hidden="true"
              className="price-tag-alive pointer-events-none absolute -top-3 right-4 z-20 inline-flex items-baseline gap-1 rounded-full bg-dream-purple px-3.5 py-1.5 font-display text-white shadow-[0_3px_0_0_rgba(27,20,88,0.25)]"
              style={{ "--base-tilt": `${cat.tagTilt}deg` } as CSSProperties}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/75">
                from
              </span>
              <span className="font-display text-[15px] font-bold">
                {cat.startingAt}
              </span>
            </span>

            <div className="relative flex aspect-square w-full items-center justify-center">
              <Image
                src={cat.image}
                alt={`${cat.label} illustration`}
                width={400}
                height={400}
                className="relative z-10 h-auto transition-transform duration-300 ease-out group-hover:scale-105"
                style={{ width: cat.imageWidth }}
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
    </section>
  );
}
