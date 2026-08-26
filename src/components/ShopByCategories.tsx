import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

type Category = {
  label: string;
  href: string;
  image: string;
  imageAlt: string;
  imageTitle: string;
  imageWidth: string;
  startingAt: string;
  tagTilt: number;
  photo?: boolean;
  photoScale?: number;
  /** Horizontal pan, as a CSS length/percentage. Negative slides the image LEFT
   *  in its frame, bringing what sat past the right edge into view. Needs a
   *  photoScale above 1 to have anything to pan into: these source photos are
   *  square in a square frame, so object-cover crops nothing and
   *  object-position alone does nothing at all. */
  photoPan?: string;
};

const CATEGORIES: Category[] = [
  {
    label: "Shirts",
    href: "/shop?category=shirts",
    image: "/shopbycategories/custom-printed-t-shirts-vancouver.jpg",
    imageAlt: "Stack of folded screen-printed t-shirts in white, yellow, and grey with graphic designs",
    imageTitle: "Custom t-shirts",
    imageWidth: "100%",
    startingAt: "$12",
    tagTilt: -6,
    photo: true,
    photoScale: 1.3,
    photoPan: "-15%",
  },
  {
    label: "Hoodies",
    href: "/shop?category=hoodies",
    image: "/shopbycategories/custom-printed-hoodies-vancouver.jpeg",
    imageAlt: "Three custom-printed pullover hoodies in charcoal, olive green, and navy with screen-printed front graphics",
    imageTitle: "Custom hoodies",
    imageWidth: "100%",
    startingAt: "$32",
    tagTilt: 5,
    photo: true,
  },
  {
    label: "Hats",
    href: "/shop?category=hats-toques",
    image: "/shopbycategories/custom-embroidered-dad-caps-vancouver-v2.webp",
    imageAlt: "Stack of four embroidered dad caps in green, maroon, navy, and grey on a light grey background",
    imageTitle: "Custom embroidered hats",
    imageWidth: "100%",
    startingAt: "$18",
    tagTilt: -4,
    photo: true,
  },
  {
    label: "Bags",
    href: "/shop?category=totes",
    image: "/shopbycategories/custom-tote-bags-vancouver.webp",
    imageAlt: "Three natural cotton canvas tote bags with orange printed graphics",
    imageTitle: "Custom tote bags",
    imageWidth: "100%",
    startingAt: "$14",
    tagTilt: 6,
    photo: true,
  },
];

export default function ShopByCategories() {
  return (
    <section className="relative bg-white">
      <div className="mx-auto max-w-[1620px] px-6 pt-24 pb-14 sm:pt-28 sm:pb-32 lg:px-12 lg:pt-32 lg:pb-36">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          <h2 className="font-display text-[30px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[48px] lg:text-[60px]">
            Ready to print
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
            className="group rough-card relative flex flex-col items-center gap-2 px-1 py-2 transition-transform duration-200 hover:-translate-y-1 sm:gap-4 sm:px-1 sm:py-2"
          >
            <span
              aria-hidden="true"
              className="price-tag-alive pointer-events-none absolute -top-3 right-3 z-20 inline-flex items-baseline gap-1 rounded-full bg-dream-purple px-3.5 py-1.5 font-display text-white shadow-[0_3px_0_0_rgba(27,20,88,0.5)] ring-2 ring-white sm:-top-4 sm:gap-1.5 sm:px-5 sm:py-2.5 sm:shadow-[0_4px_0_0_rgba(27,20,88,0.5)]"
              style={{ "--base-tilt": `${cat.tagTilt}deg` } as CSSProperties}
            >
              <span className="text-[14px] font-bold uppercase tracking-[0.1em] text-white/85 sm:text-[14px]">
                from
              </span>
              <span className="font-display text-base font-bold leading-none sm:text-xl">
                {cat.startingAt}
              </span>
            </span>

            <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl">
              <Image
                src={cat.image}
                alt={cat.imageAlt}
                title={cat.imageTitle}
                width={400}
                height={400}
                className={
                  cat.photo
                    ? "absolute inset-0 z-10 h-full w-full object-cover brightness-105 contrast-[1.03] saturate-[1.05] transition-transform duration-300 ease-out group-hover:scale-105"
                    : "relative z-10 h-auto transition-transform duration-300 ease-out group-hover:scale-105"
                }
                style={
                  cat.photo
                    ? cat.photoScale || cat.photoPan
                      ? {
                          transform: `scale(${cat.photoScale ?? 1})${cat.photoPan ? ` translateX(${cat.photoPan})` : ""}`,
                        }
                      : undefined
                    : { width: cat.imageWidth }
                }
              />
            </div>

            <div className="flex w-full flex-col items-center">
              <div className="relative inline-flex flex-col items-center">
                {/* font-daruma matches the other card titles across the site
                    (How It Works, the order steps, reviews, the nav menu). */}
                <span className="font-daruma text-[23px] leading-tight text-dream-ink sm:text-[30px]">
                  {cat.label}
                </span>
                {/* Scribble scales with the label so it stays proportional. */}
                <div className="relative mt-1 h-[5px] w-11 sm:h-[6px] sm:w-14">
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
