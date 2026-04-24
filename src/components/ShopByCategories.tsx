import Image from "next/image";
import Link from "next/link";

type Category = {
  label: string;
  href: string;
  blob: string;
  blobWidth: number;
  blobHeight: number;
  image: string;
  imageWidth: string;
};

const CATEGORIES: Category[] = [
  {
    label: "Shirts",
    href: "/quote?product=shirt",
    blob: "/shopbycategories/shirtblob.svg",
    blobWidth: 333,
    blobHeight: 267,
    image: "/shopbycategories/shirtcategory.png",
    imageWidth: "58%",
  },
  {
    label: "Hoodies",
    href: "/quote?product=hoodie",
    blob: "/shopbycategories/hoodieblob.svg",
    blobWidth: 360,
    blobHeight: 284,
    image: "/shopbycategories/hoodiecategory.png",
    imageWidth: "60%",
  },
  {
    label: "Hats",
    href: "/quote?product=hat",
    blob: "/shopbycategories/hatblob.svg",
    blobWidth: 357,
    blobHeight: 288,
    image: "/shopbycategories/hatcategory.png",
    imageWidth: "66%",
  },
  {
    label: "Bags",
    href: "/quote?product=bag",
    blob: "/shopbycategories/bagsblob.svg",
    blobWidth: 358,
    blobHeight: 269,
    image: "/shopbycategories/bagscategory.png",
    imageWidth: "54%",
  },
];

export default function ShopByCategories() {
  return (
    <section className="mx-auto max-w-[1550px] px-6 pt-10 pb-20 lg:px-10 lg:pt-14 lg:pb-28">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0"
      >
        <defs>
          <filter
            id="blob-morph"
            x="-15%"
            y="-15%"
            width="130%"
            height="130%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018"
              numOctaves="2"
              seed="1"
              result="noise"
            >
              <animate
                attributeName="seed"
                values="1;2;3"
                dur="1.2s"
                repeatCount="indefinite"
                calcMode="discrete"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" />
          </filter>
        </defs>
      </svg>

      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl font-bold text-dream-ink sm:text-3xl">
          Shop by categories
        </h2>
        <Link
          href="/quote"
          className="font-display text-sm font-semibold text-dream-purple underline-offset-4 hover:underline sm:text-base"
        >
          Shop all
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.label}
            href={cat.href}
            className="group flex flex-col items-center"
          >
            <div className="relative flex aspect-[4/3] w-full items-center justify-center">
              <Image
                src={cat.blob}
                alt=""
                width={cat.blobWidth}
                height={cat.blobHeight}
                className="blob-morph absolute inset-0 h-full w-full object-contain"
                aria-hidden="true"
              />
              <Image
                src={cat.image}
                alt={`${cat.label} illustration`}
                width={400}
                height={400}
                className="relative z-10 h-auto"
                style={{ width: cat.imageWidth }}
              />
            </div>
            <div className="relative mt-3 inline-flex flex-col items-center">
              <span className="font-display text-base font-bold text-dream-ink sm:text-lg">
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
          </Link>
        ))}
      </div>
    </section>
  );
}
